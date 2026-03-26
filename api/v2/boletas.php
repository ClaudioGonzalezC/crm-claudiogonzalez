<?php
/**
 * /api/v2/boletas.php
 *
 * GET   ?project_id=X
 *       Retorna todas las boletas del proyecto + totales agregados + status_v2.
 *
 * POST  { project_id, numero_boleta, fecha_emision, rut_receptor,
 *          monto_bruto, retencion_pct?, tipo_cobro }
 *       Crea boleta en estado Draft.
 *       Solo permitido si proyectos.status_v2 IN ('Executing', 'Boleta').
 *       monto_retencion y monto_liquido son columnas STORED — MySQL las calcula.
 *
 * PATCH ?boleta_id=X  { "action": "mark_issued" | "mark_paid" | "mark_f29", ...campos }
 *       Transiciones de estado estrictas:
 *         mark_issued → solo desde Draft
 *         mark_paid   → solo desde Issued o Overdue
 *         mark_f29    → solo si status = Paid
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica status_v2. No llama WorkflowService. No toca endpoints anteriores.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include_once '../../config/config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ─────────────────────────────────────────────────────────────
// CONSTANTES de workflow
// ─────────────────────────────────────────────────────────────
const ALLOWED_POST_STATES  = ['Executing', 'Boleta'];
const TIPO_COBRO_VALID     = ['Anticipo', 'Cuota1', 'Cuota2', 'Final'];
const PAYMENT_METHOD_VALID = ['Transferencia', 'Webpay', 'Paypal'];

// Máquina de estados de boleta
const BOLETA_TRANSITIONS = [
    'mark_issued' => ['from' => ['Draft'],             'to' => 'Issued'],
    'mark_paid'   => ['from' => ['Issued', 'Overdue'], 'to' => 'Paid'],
    'mark_f29'    => ['from' => ['Paid'],              'to' => null],   // no cambia status
];

// ─────────────────────────────────────────────────────────────
// HELPER — leer proyecto y verificar existencia
// ─────────────────────────────────────────────────────────────
function fetchProyecto(PDO $conn, int $project_id): ?array
{
    $stmt = $conn->prepare("
        SELECT id, status_v2, nombre_proyecto
        FROM   proyectos
        WHERE  id = :id
    ");
    $stmt->execute([':id' => $project_id]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

// ─────────────────────────────────────────────────────────────
// HELPER — leer retention_rate_2026 desde settings
// ─────────────────────────────────────────────────────────────
function getRetentionRate(PDO $conn): float
{
    $stmt = $conn->prepare("
        SELECT value FROM settings WHERE `key` = 'retention_rate_2026' LIMIT 1
    ");
    $stmt->execute();
    $val = $stmt->fetchColumn();
    return $val !== false ? (float) $val : 15.25;
}

// ─────────────────────────────────────────────────────────────
// GET — lista boletas del proyecto + totales + status_v2
// ─────────────────────────────────────────────────────────────
if ($method === 'GET') {

    $project_id = isset($_GET['project_id']) ? (int) $_GET['project_id'] : 0;

    if ($project_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
        exit;
    }

    try {
        $proyecto = fetchProyecto($conn, $project_id);
        if (!$proyecto) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
            exit;
        }

        $stmtB = $conn->prepare("
            SELECT id, project_id, numero_boleta, status,
                   fecha_emision, rut_receptor,
                   monto_bruto, retencion_pct,
                   monto_retencion, monto_liquido,
                   tipo_cobro, paid_date,
                   payment_method, payment_reference,
                   f29_paid, created_at
            FROM   boletas
            WHERE  project_id = :pid
            ORDER  BY fecha_emision ASC, id ASC
        ");
        $stmtB->execute([':pid' => $project_id]);
        $rows = $stmtB->fetchAll(PDO::FETCH_ASSOC);

        $total_bruto      = 0.0;
        $total_liquido    = 0.0;
        $liquido_cobrado  = 0.0;
        $f29_pendientes   = 0;

        foreach ($rows as &$b) {
            $b['id']              = (int)    $b['id'];
            $b['project_id']      = (int)    $b['project_id'];
            $b['monto_bruto']     = (float)  $b['monto_bruto'];
            $b['retencion_pct']   = (float)  $b['retencion_pct'];
            $b['monto_retencion'] = (float)  $b['monto_retencion'];
            $b['monto_liquido']   = (float)  $b['monto_liquido'];
            $b['f29_paid']        = (bool)   $b['f29_paid'];

            $total_bruto   += $b['monto_bruto'];
            $total_liquido += $b['monto_liquido'];

            if ($b['paid_date'] !== null) {
                $liquido_cobrado += $b['monto_liquido'];
            }
            if (!$b['f29_paid'] && $b['paid_date'] !== null) {
                $f29_pendientes++;
            }
        }
        unset($b);

        echo json_encode([
            'success'    => true,
            'project_id' => $project_id,
            'status_v2'  => $proyecto['status_v2'],
            'boletas'    => $rows,
            'totales'    => [
                'total_bruto'     => round($total_bruto,   2),
                'total_liquido'   => round($total_liquido, 2),
                'liquido_cobrado' => round($liquido_cobrado, 2),
                'f29_pendientes'  => $f29_pendientes,
            ],
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// POST — crear boleta (solo en Executing o Boleta)
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'POST') {

    $input = json_decode(file_get_contents('php://input'), true);

    $project_id     = isset($input['project_id'])    ? (int)    $input['project_id']   : 0;
    $numero_boleta  = isset($input['numero_boleta']) ? trim($input['numero_boleta'])    : '';
    $fecha_emision  = isset($input['fecha_emision']) ? trim($input['fecha_emision'])    : '';
    $rut_receptor   = isset($input['rut_receptor'])  ? trim($input['rut_receptor'])     : '';
    $monto_bruto    = isset($input['monto_bruto'])   ? (float)  $input['monto_bruto']  : 0;
    $tipo_cobro     = isset($input['tipo_cobro'])    ? trim($input['tipo_cobro'])       : '';
    $retencion_pct  = isset($input['retencion_pct']) ? (float)  $input['retencion_pct'] : null;

    // ── Validaciones básicas ──────────────────────────────────
    if ($project_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
        exit;
    }
    if ($numero_boleta === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'numero_boleta es obligatorio.']);
        exit;
    }
    if ($fecha_emision === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha_emision)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'fecha_emision debe tener formato YYYY-MM-DD.']);
        exit;
    }
    if ($rut_receptor === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'rut_receptor es obligatorio.']);
        exit;
    }
    if ($monto_bruto <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'monto_bruto debe ser mayor que 0.']);
        exit;
    }
    if (!in_array($tipo_cobro, TIPO_COBRO_VALID, true)) {
        http_response_code(422);
        echo json_encode([
            'success'      => false,
            'error'        => "tipo_cobro '$tipo_cobro' no válido.",
            'valid_values' => TIPO_COBRO_VALID,
        ]);
        exit;
    }
    if ($retencion_pct !== null && ($retencion_pct < 0 || $retencion_pct > 100)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'retencion_pct debe estar entre 0 y 100.']);
        exit;
    }

    try {
        // ── Verificar proyecto + status_v2 ───────────────────
        $proyecto = fetchProyecto($conn, $project_id);
        if (!$proyecto) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
            exit;
        }

        if (!in_array($proyecto['status_v2'], ALLOWED_POST_STATES, true)) {
            http_response_code(422);
            echo json_encode([
                'success'       => false,
                'error'         => "No se puede crear una boleta en estado '{$proyecto['status_v2']}'.",
                'allowed_states'=> ALLOWED_POST_STATES,
                'current_state' => $proyecto['status_v2'],
                'hint'          => "Transiciona el proyecto a 'Executing' o 'Boleta' antes de emitir boletas.",
            ]);
            exit;
        }

        // ── Usar retencion_pct del seed si no se envió ───────
        if ($retencion_pct === null) {
            $retencion_pct = getRetentionRate($conn);
        }

        // ── INSERT boleta ─────────────────────────────────────
        // monto_retencion y monto_liquido son STORED — MySQL los calcula
        $stmtIns = $conn->prepare("
            INSERT INTO boletas
                (project_id, numero_boleta, status, fecha_emision,
                 rut_receptor, monto_bruto, retencion_pct, tipo_cobro)
            VALUES
                (:pid, :num, 'Draft', :fecha,
                 :rut, :bruto, :retencion, :tipo)
        ");
        $stmtIns->execute([
            ':pid'      => $project_id,
            ':num'      => $numero_boleta,
            ':fecha'    => $fecha_emision,
            ':rut'      => $rut_receptor,
            ':bruto'    => $monto_bruto,
            ':retencion'=> $retencion_pct,
            ':tipo'     => $tipo_cobro,
        ]);

        $boleta_id = (int) $conn->lastInsertId();

        // Leer row completo (incluye columnas STORED calculadas por MySQL)
        $stmtRead = $conn->prepare("
            SELECT id, numero_boleta, status, fecha_emision,
                   rut_receptor, monto_bruto, retencion_pct,
                   monto_retencion, monto_liquido,
                   tipo_cobro, created_at
            FROM   boletas
            WHERE  id = :id
        ");
        $stmtRead->execute([':id' => $boleta_id]);
        $boleta = $stmtRead->fetch(PDO::FETCH_ASSOC);

        $boleta['id']              = (int)   $boleta['id'];
        $boleta['monto_bruto']     = (float) $boleta['monto_bruto'];
        $boleta['retencion_pct']   = (float) $boleta['retencion_pct'];
        $boleta['monto_retencion'] = (float) $boleta['monto_retencion'];
        $boleta['monto_liquido']   = (float) $boleta['monto_liquido'];

        echo json_encode([
            'success'    => true,
            'message'    => 'Boleta creada en estado Draft.',
            'boleta_id'  => $boleta_id,
            'project_id' => $project_id,
            'status_v2'  => $proyecto['status_v2'],
            'boleta'     => $boleta,
        ]);

    } catch (PDOException $e) {
        // Capturar duplicado en numero_boleta (UNIQUE constraint)
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error'   => "El número de boleta '$numero_boleta' ya existe.",
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
        }
    }

// ─────────────────────────────────────────────────────────────
// PATCH — transiciones de estado de boleta
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'PATCH') {

    $boleta_id = isset($_GET['boleta_id']) ? (int) $_GET['boleta_id'] : 0;

    if ($boleta_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'boleta_id es obligatorio como query param.']);
        exit;
    }

    $input  = json_decode(file_get_contents('php://input'), true);
    $action = isset($input['action']) ? trim($input['action']) : '';

    if (!array_key_exists($action, BOLETA_TRANSITIONS)) {
        http_response_code(422);
        echo json_encode([
            'success'        => false,
            'error'          => "Acción '$action' no válida.",
            'valid_actions'  => array_keys(BOLETA_TRANSITIONS),
        ]);
        exit;
    }

    try {
        // Leer boleta actual
        $stmtB = $conn->prepare("
            SELECT id, project_id, status, paid_date, f29_paid
            FROM   boletas
            WHERE  id = :id
        ");
        $stmtB->execute([':id' => $boleta_id]);
        $boleta = $stmtB->fetch(PDO::FETCH_ASSOC);

        if (!$boleta) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Boleta $boleta_id no encontrada."]);
            exit;
        }

        $current_status = $boleta['status'];
        $allowed_from   = BOLETA_TRANSITIONS[$action]['from'];

        // ── Validar transición ────────────────────────────────
        if (!in_array($current_status, $allowed_from, true)) {
            http_response_code(422);
            echo json_encode([
                'success'        => false,
                'error'          => "Acción '$action' no permitida desde estado '$current_status'.",
                'allowed_from'   => $allowed_from,
                'current_status' => $current_status,
            ]);
            exit;
        }

        // ── Ejecutar acción ───────────────────────────────────
        if ($action === 'mark_issued') {
            $stmt = $conn->prepare("
                UPDATE boletas SET status = 'Issued' WHERE id = :id
            ");
            $stmt->execute([':id' => $boleta_id]);

            echo json_encode([
                'success'    => true,
                'message'    => 'Boleta marcada como Issued.',
                'boleta_id'  => $boleta_id,
                'status'     => 'Issued',
            ]);

        } elseif ($action === 'mark_paid') {
            $paid_date         = isset($input['paid_date'])         ? trim($input['paid_date'])         : '';
            $payment_method    = isset($input['payment_method'])    ? trim($input['payment_method'])    : null;
            $payment_reference = isset($input['payment_reference']) ? trim($input['payment_reference']) : null;

            if ($paid_date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $paid_date)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'paid_date es obligatorio (YYYY-MM-DD).']);
                exit;
            }
            if ($payment_method !== null && !in_array($payment_method, PAYMENT_METHOD_VALID, true)) {
                http_response_code(422);
                echo json_encode([
                    'success'      => false,
                    'error'        => "payment_method '$payment_method' no válido.",
                    'valid_values' => PAYMENT_METHOD_VALID,
                ]);
                exit;
            }

            $stmt = $conn->prepare("
                UPDATE boletas
                SET    status             = 'Paid',
                       paid_date          = :paid_date,
                       payment_method     = :method,
                       payment_reference  = :reference
                WHERE  id = :id
            ");
            $stmt->execute([
                ':paid_date'  => $paid_date,
                ':method'     => $payment_method,
                ':reference'  => $payment_reference,
                ':id'         => $boleta_id,
            ]);

            echo json_encode([
                'success'           => true,
                'message'           => 'Boleta marcada como Paid.',
                'boleta_id'         => $boleta_id,
                'status'            => 'Paid',
                'paid_date'         => $paid_date,
                'payment_method'    => $payment_method,
                'payment_reference' => $payment_reference,
            ]);

        } elseif ($action === 'mark_f29') {
            // Solo posible si status = Paid (ya validado arriba)
            if ((int) $boleta['f29_paid'] === 1) {
                echo json_encode([
                    'success'   => true,
                    'message'   => 'F29 ya estaba marcado.',
                    'boleta_id' => $boleta_id,
                    'f29_paid'  => true,
                ]);
                exit;
            }

            $stmt = $conn->prepare("
                UPDATE boletas SET f29_paid = 1 WHERE id = :id
            ");
            $stmt->execute([':id' => $boleta_id]);

            echo json_encode([
                'success'   => true,
                'message'   => 'F29 marcado como pagado.',
                'boleta_id' => $boleta_id,
                'f29_paid'  => true,
            ]);
        }

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// Método no soportado
// ─────────────────────────────────────────────────────────────
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Usa GET, POST o PATCH.']);
}
?>
