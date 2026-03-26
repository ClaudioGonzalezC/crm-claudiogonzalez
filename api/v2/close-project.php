<?php
/**
 * /api/v2/close-project.php
 *
 * POST  { "project_id": X }
 *       Cierra formalmente el proyecto ejecutando finalize_close.
 *
 * Precondiciones (todas deben cumplirse):
 *   1. status_v2 = 'Boleta'              ← única transición válida a Closed
 *   2. emotional_eval_completed = 1      ← crm_spec.md flag obligatorio
 *   3. profit_calculated = 1             ← crm_spec.md flag obligatorio
 *   4. net_profit IS NOT NULL            ← integridad: si está calculado debe tener valor
 *
 * Escribe solo:
 *   - proyectos.status_v2 = 'Closed'
 *   - proyectos.closed_at = NOW()
 *
 * Idempotente: si ya está Closed retorna el estado actual sin error.
 *
 * Lógica de transición delegada a WorkflowService (fuente de verdad).
 * No llama transition.php por HTTP. No reimplementa reglas de workflow.
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica ningún otro campo. No toca endpoints anteriores.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Usa POST.']);
    exit;
}

include_once '../../config/config.php';
include_once 'WorkflowService.php';

// ─────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────
$input      = json_decode(file_get_contents('php://input'), true);
$project_id = isset($input['project_id']) ? (int) $input['project_id'] : 0;

if ($project_id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
    exit;
}

try {
    // ─────────────────────────────────────────────────────────
    // 1. Leer proyecto — todos los campos relevantes para cierre
    // ─────────────────────────────────────────────────────────
    $stmt = $conn->prepare("
        SELECT id, status_v2,
               has_project_eval,
               emotional_eval_completed,
               profit_calculated,
               net_profit,
               closed_at
        FROM   proyectos
        WHERE  id = :id
    ");
    $stmt->execute([':id' => $project_id]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$proyecto) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
        exit;
    }

    $status_v2 = $proyecto['status_v2'];

    // ─────────────────────────────────────────────────────────
    // 2. Idempotencia — si ya está Closed retornar sin error
    // ─────────────────────────────────────────────────────────
    if (WorkflowService::isClosed((string) $status_v2)) {
        echo json_encode([
            'success'       => true,
            'message'       => 'El proyecto ya estaba cerrado.',
            'project_id'    => $project_id,
            'status_v2'     => 'Closed',
            'closed_at'     => $proyecto['closed_at'],
            'already_closed'=> true,
        ]);
        exit;
    }

    // ─────────────────────────────────────────────────────────
    // 3. Validación de integridad de datos — ANTES de workflow
    //    profit_calculated = 1 con net_profit NULL es inválido.
    //    No se cierra un proyecto con rentabilidad inconsistente.
    // ─────────────────────────────────────────────────────────
    if ((int) $proyecto['profit_calculated'] === 1 && $proyecto['net_profit'] === null) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error'   => 'Integridad de datos: profit_calculated está marcado como 1 pero net_profit es NULL. '
                       . 'Ejecuta calculate-profit.php nuevamente para corregir el estado.',
            'field'   => 'net_profit',
            'type'    => 'data_integrity_error',
        ]);
        exit;
    }

    // ─────────────────────────────────────────────────────────
    // 4. Recopilar TODOS los fallos de precondición antes de
    //    bloquear — mejor UX que reportar uno a la vez.
    //    Luego WorkflowService es la validación autoritativa final.
    // ─────────────────────────────────────────────────────────
    $flags = [
        'has_project_eval'         => (int) $proyecto['has_project_eval'],
        'emotional_eval_completed' => (int) $proyecto['emotional_eval_completed'],
        'profit_calculated'        => (int) $proyecto['profit_calculated'],
    ];

    $failed = [];

    // Verificar status_v2 manualmente para dar hint específico
    if ($status_v2 !== 'Boleta') {
        $valid_from = WorkflowService::getValidTransitions((string) $status_v2);
        $failed[] = [
            'field'   => 'status_v2',
            'current' => $status_v2,
            'required'=> 'Boleta',
            'hint'    => $status_v2 === 'Closed'
                ? 'El proyecto ya está cerrado.'
                : "El proyecto debe estar en estado 'Boleta' para cerrar. Estado actual: '$status_v2'.",
        ];
    }

    if ((int) $proyecto['emotional_eval_completed'] !== 1) {
        $failed[] = [
            'field'   => 'emotional_eval_completed',
            'current' => false,
            'required'=> true,
            'hint'    => 'Completa la evaluación emocional (emotional-eval.php) antes de cerrar.',
        ];
    }

    if ((int) $proyecto['profit_calculated'] !== 1) {
        $failed[] = [
            'field'   => 'profit_calculated',
            'current' => false,
            'required'=> true,
            'hint'    => 'Ejecuta calculate-profit.php antes de cerrar.',
        ];
    }

    // Si hay precondiciones fallidas, retornar todas juntas
    if (!empty($failed)) {
        http_response_code(422);
        echo json_encode([
            'success'              => false,
            'error'                => 'No se puede cerrar el proyecto. Precondiciones incumplidas.',
            'failed_preconditions' => $failed,
        ]);
        exit;
    }

    // ─────────────────────────────────────────────────────────
    // 5. Validación autoritativa — WorkflowService (fuente de verdad)
    //    Si los checks manuales pasaron pero WorkflowService difiere,
    //    WorkflowService gana. Nunca se reimplementan sus reglas.
    // ─────────────────────────────────────────────────────────
    $validation = WorkflowService::validateTransition(
        (string) $status_v2,
        'Closed',
        $flags
    );

    if (!$validation['valid']) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error'   => $validation['reason'],
            'flag'    => $validation['flag'],
            'source'  => 'WorkflowService',
        ]);
        exit;
    }

    // ─────────────────────────────────────────────────────────
    // 6. Ejecutar cierre — solo status_v2 y closed_at
    //    Nada más. Ningún otro campo.
    // ─────────────────────────────────────────────────────────
    $stmtClose = $conn->prepare("
        UPDATE proyectos
        SET    status_v2  = 'Closed',
               closed_at  = NOW()
        WHERE  id = :id
    ");
    $stmtClose->execute([':id' => $project_id]);

    // Leer closed_at real guardado por MySQL
    $stmtDate = $conn->prepare("SELECT closed_at FROM proyectos WHERE id = :id");
    $stmtDate->execute([':id' => $project_id]);
    $closed_at = $stmtDate->fetchColumn();

    // ─────────────────────────────────────────────────────────
    // 7. Respuesta auditada — preconditions del estado previo
    // ─────────────────────────────────────────────────────────
    echo json_encode([
        'success'       => true,
        'message'       => 'Proyecto cerrado exitosamente.',
        'project_id'    => $project_id,
        'status_v2'     => 'Closed',
        'closed_at'     => $closed_at,
        'already_closed'=> false,
        'preconditions' => [
            'status_v2_was'            => $status_v2,
            'emotional_eval_completed' => true,
            'profit_calculated'        => true,
            'net_profit'               => (float) $proyecto['net_profit'],
        ],
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
}
?>
