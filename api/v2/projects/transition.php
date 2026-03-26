<?php
/**
 * POST /api/v2/projects/transition.php
 *
 * Cambia status_v2 de un proyecto validando el workflow V2.
 * NO modifica el campo legacy `estado`. Solo actúa sobre status_v2.
 *
 * Body JSON:
 *   { "project_id": 5, "to": "Evaluating" }
 *
 * Respuesta éxito (200):
 *   { "success": true, "project_id": 5, "from": "Draft", "to": "Evaluating", "message": "..." }
 *
 * Respuesta error (422 / 400 / 404 / 405):
 *   { "success": false, "error": "...", "from": "...", "to": "...", "flag": "..." }
 *
 * Source of truth: /docs/crm_spec.md
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Usa POST.']);
    exit;
}

// Rutas: api/v2/projects/ → necesita subir 3 niveles para config/
include_once '../../../config/config.php';
include_once '../WorkflowService.php';

// ─────────────────────────────────────────────────────────────
// 1. Leer y validar body
// ─────────────────────────────────────────────────────────────
$input      = json_decode(file_get_contents('php://input'), true);
$project_id = isset($input['project_id']) ? (int) $input['project_id'] : 0;
$to         = isset($input['to'])         ? trim($input['to'])          : '';

if ($project_id <= 0 || $to === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'project_id (entero > 0) y to (string) son obligatorios.',
    ]);
    exit;
}

try {
    // ─────────────────────────────────────────────────────────────
    // 2. Obtener estado actual y flags V2 del proyecto
    // ─────────────────────────────────────────────────────────────
    $stmt = $conn->prepare("
        SELECT status_v2,
               has_project_eval,
               emotional_eval_completed,
               profit_calculated
        FROM   proyectos
        WHERE  id = :id
    ");
    $stmt->execute([':id' => $project_id]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$project) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
        exit;
    }

    // Si status_v2 es NULL (proyecto legacy) lo tratamos como Draft
    $from  = $project['status_v2'] ?? 'Draft';
    $flags = [
        'has_project_eval'         => (int) $project['has_project_eval'],
        'emotional_eval_completed' => (int) $project['emotional_eval_completed'],
        'profit_calculated'        => (int) $project['profit_calculated'],
    ];

    // ─────────────────────────────────────────────────────────────
    // 3. Validar transición con WorkflowService
    // ─────────────────────────────────────────────────────────────
    $validation = WorkflowService::validateTransition($from, $to, $flags);

    if (!$validation['valid']) {
        http_response_code(422);
        $response = [
            'success' => false,
            'error'   => $validation['reason'],
            'from'    => $from,
            'to'      => $to,
        ];
        if ($validation['flag']) {
            $response['flag'] = $validation['flag'];
        }
        echo json_encode($response);
        exit;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Aplicar la transición en DB
    //    Si destino es Closed → también registrar closed_at
    // ─────────────────────────────────────────────────────────────
    if (WorkflowService::isClosed($to)) {
        $closed_at = date('Y-m-d H:i:s');
        $updateStmt = $conn->prepare("
            UPDATE proyectos
            SET    status_v2  = :status_v2,
                   closed_at  = :closed_at
            WHERE  id = :id
        ");
        $updateStmt->execute([
            ':status_v2' => $to,
            ':closed_at' => $closed_at,
            ':id'        => $project_id,
        ]);
    } else {
        $closed_at = null;
        $updateStmt = $conn->prepare("
            UPDATE proyectos
            SET status_v2 = :status_v2
            WHERE id = :id
        ");
        $updateStmt->execute([
            ':status_v2' => $to,
            ':id'        => $project_id,
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Respuesta
    // ─────────────────────────────────────────────────────────────
    $response = [
        'success'    => true,
        'message'    => "Proyecto $project_id: '$from' → '$to'.",
        'project_id' => $project_id,
        'from'       => $from,
        'to'         => $to,
    ];

    if ($closed_at) {
        $response['closed_at'] = $closed_at;
    }

    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
}
?>
