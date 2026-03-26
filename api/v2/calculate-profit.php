<?php
/**
 * /api/v2/calculate-profit.php
 *
 * POST  { "project_id": X }
 *       Calcula net_profit usando la fórmula oficial V2 y guarda el resultado.
 *       No cambia status_v2 bajo ninguna circunstancia.
 *
 * Fórmula oficial (crm_spec.md):
 *   net_profit =
 *     total_liquido_cobrado          ← SUM(boletas.monto_liquido WHERE paid_date IS NOT NULL)
 *     - (real_hours × cost_hour)     ← proyectos.real_hours × proyectos.cost_hour (snapshot)
 *     - total_expenses               ← SUM(project_expenses.amount)
 *     - overhead_snapshot            ← proyectos.overhead_snapshot (snapshot congelado)
 *
 * Fallback policy:
 *   cost_hour NULL       → settings.effective_hourly_cost (legacy approximation, documentado)
 *   overhead_snapshot NULL → 0 (comportamiento conservador, documentado)
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica status_v2. No toca endpoints anteriores. No modifica DB schema.
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

// Estados tempranos que ameritan warning suave (no bloqueo)
const EARLY_STATES = ['Draft', 'Evaluating', 'Quoted', 'Approved'];

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
    // 1. Leer proyecto
    // ─────────────────────────────────────────────────────────
    $stmtP = $conn->prepare("
        SELECT id, status_v2, real_hours, cost_hour, overhead_snapshot
        FROM   proyectos
        WHERE  id = :id
    ");
    $stmtP->execute([':id' => $project_id]);
    $proyecto = $stmtP->fetch(PDO::FETCH_ASSOC);

    if (!$proyecto) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
        exit;
    }

    // ─────────────────────────────────────────────────────────
    // 2. Resolver cost_hour con fuente auditada
    //    Prioridad: project → settings (legacy approx.) → zero
    // ─────────────────────────────────────────────────────────
    $cost_hour_source = 'project';
    $cost_hour        = $proyecto['cost_hour'] !== null ? (float) $proyecto['cost_hour'] : null;

    if ($cost_hour === null || $cost_hour === 0.0) {
        // Intentar leer desde settings como aproximación legacy
        $stmtCH = $conn->prepare("
            SELECT value FROM settings WHERE `key` = 'effective_hourly_cost' LIMIT 1
        ");
        $stmtCH->execute();
        $settingsCH = $stmtCH->fetchColumn();

        if ($settingsCH !== false && (float) $settingsCH > 0) {
            $cost_hour        = (float) $settingsCH;
            $cost_hour_source = 'settings'; // legacy approximation — no es snapshot congelado
        } else {
            $cost_hour        = 0.0;
            $cost_hour_source = 'zero';
        }
    }

    // ─────────────────────────────────────────────────────────
    // 3. Resolver overhead_snapshot con fuente auditada
    //    Política conservadora: NULL → 0 (NO usar settings por defecto)
    //    Esto evita inflar costos con overhead global en proyectos legacy
    // ─────────────────────────────────────────────────────────
    $overhead_source   = 'project';
    $overhead_snapshot = $proyecto['overhead_snapshot'] !== null
        ? (float) $proyecto['overhead_snapshot']
        : null;

    if ($overhead_snapshot === null) {
        $overhead_snapshot = 0.0;
        $overhead_source   = 'zero'; // conservador — no asumir overhead global
    }

    // ─────────────────────────────────────────────────────────
    // 4. Leer real_hours del proyecto (mantenido por trigger)
    // ─────────────────────────────────────────────────────────
    $real_hours = (float) ($proyecto['real_hours'] ?? 0);

    // ─────────────────────────────────────────────────────────
    // 5. total_liquido_cobrado desde boletas pagadas
    // ─────────────────────────────────────────────────────────
    $stmtB = $conn->prepare("
        SELECT COALESCE(SUM(monto_liquido), 0) AS total
        FROM   boletas
        WHERE  project_id = :pid
          AND  paid_date IS NOT NULL
    ");
    $stmtB->execute([':pid' => $project_id]);
    $total_liquido_cobrado = (float) $stmtB->fetchColumn();

    // ─────────────────────────────────────────────────────────
    // 6. total_expenses desde project_expenses
    // ─────────────────────────────────────────────────────────
    $stmtE = $conn->prepare("
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM   project_expenses
        WHERE  project_id = :pid
    ");
    $stmtE->execute([':pid' => $project_id]);
    $total_expenses = (float) $stmtE->fetchColumn();

    // ─────────────────────────────────────────────────────────
    // 7. Cálculo oficial (crm_spec.md)
    // ─────────────────────────────────────────────────────────
    $labor_cost = round($real_hours * $cost_hour, 2);
    $net_profit = round(
        $total_liquido_cobrado - $labor_cost - $total_expenses - $overhead_snapshot,
        2
    );

    // ─────────────────────────────────────────────────────────
    // 8. Guardar resultado en proyectos
    //    Solo escribe net_profit y profit_calculated
    //    No toca status_v2 ni ningún otro campo
    // ─────────────────────────────────────────────────────────
    $stmtU = $conn->prepare("
        UPDATE proyectos
        SET    net_profit        = :profit,
               profit_calculated = 1
        WHERE  id = :id
    ");
    $stmtU->execute([
        ':profit' => $net_profit,
        ':id'     => $project_id,
    ]);

    // ─────────────────────────────────────────────────────────
    // 9. Warning suave si el proyecto está en estado temprano
    // ─────────────────────────────────────────────────────────
    $warning = null;
    $status_v2 = $proyecto['status_v2'];

    if ($status_v2 === null || in_array($status_v2, EARLY_STATES, true)) {
        $warning = "El proyecto está en estado '$status_v2'. "
                 . "El cálculo puede no representar la rentabilidad final: "
                 . "aún pueden faltar boletas, horas o gastos por registrar.";
    }

    // ─────────────────────────────────────────────────────────
    // 10. Respuesta auditada
    // ─────────────────────────────────────────────────────────
    $response = [
        'success'          => true,
        'project_id'       => $project_id,
        'net_profit'       => $net_profit,
        'profit_calculated'=> true,
        'breakdown'        => [
            'total_liquido_cobrado' => round($total_liquido_cobrado, 2),
            'real_hours'            => $real_hours,
            'cost_hour'             => $cost_hour,
            'labor_cost'            => $labor_cost,
            'total_expenses'        => round($total_expenses, 2),
            'overhead_snapshot'     => $overhead_snapshot,
            'formula'               => sprintf(
                '%s - %s - %s - %s = %s',
                number_format($total_liquido_cobrado, 2, '.', ''),
                number_format($labor_cost,            2, '.', ''),
                number_format($total_expenses,        2, '.', ''),
                number_format($overhead_snapshot,     2, '.', ''),
                number_format($net_profit,            2, '.', '')
            ),
        ],
        'inputs_source'    => [
            'cost_hour'         => $cost_hour_source,
            'overhead_snapshot' => $overhead_source,
        ],
        'fallback_used'    => ($cost_hour_source !== 'project' || $overhead_source !== 'project'),
    ];

    if ($warning !== null) {
        $response['warning'] = $warning;
    }

    echo json_encode($response);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
}
?>
