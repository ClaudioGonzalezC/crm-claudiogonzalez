<?php
/**
 * /api/v2/quotes.php
 *
 * GET   ?project_id=5
 *       Retorna la quote del proyecto + sus quote_items.
 *
 * POST  {
 *         "project_id":  5,
 *         "buffer_pct":  15.00,
 *         "items": [
 *           { "task_name": "Diseño UI", "est_hours": 10, "hourly_rate": 25000 },
 *           { "task_name": "Backend",   "est_hours": 20, "hourly_rate": 25000 }
 *         ]
 *       }
 *       Crea o actualiza la quote (una por proyecto).
 *       Reemplaza todos los quote_items.
 *       Calcula: line_total, subtotal, projected_bruto, projected_liquido.
 *       Requiere has_project_eval = 1 (regla workflow V2).
 *
 * PATCH ?quote_id=3
 *       Aprueba la quote existente (approved = 1, approved_date = NOW()).
 *       No crea nada. No modifica items. Idempotente.
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica tablas legacy. No cambia status_v2. No llama WorkflowService.
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
// HELPER — leer retention_rate_2026 desde settings
// ─────────────────────────────────────────────────────────────
function getRetentionRate(PDO $conn): float
{
    $stmt = $conn->prepare("
        SELECT value FROM settings WHERE `key` = 'retention_rate_2026' LIMIT 1
    ");
    $stmt->execute();
    $val = $stmt->fetchColumn();
    return $val !== false ? (float) $val : 15.25; // fallback al valor oficial del seed
}

// ─────────────────────────────────────────────────────────────
// GET — retorna quote + items del proyecto
// ─────────────────────────────────────────────────────────────
if ($method === 'GET') {

    $project_id = isset($_GET['project_id']) ? (int) $_GET['project_id'] : 0;

    if ($project_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
        exit;
    }

    try {
        // 1. Verificar que el proyecto existe
        $stmtP = $conn->prepare("SELECT id FROM proyectos WHERE id = :id");
        $stmtP->execute([':id' => $project_id]);
        if (!$stmtP->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
            exit;
        }

        // 2. Obtener quote (puede no existir aún)
        $stmtQ = $conn->prepare("
            SELECT id, project_id, version_num,
                   subtotal, buffer_pct,
                   projected_bruto, projected_liquido,
                   approved, approved_date,
                   created_at
            FROM   quotes
            WHERE  project_id = :pid
        ");
        $stmtQ->execute([':pid' => $project_id]);
        $quote = $stmtQ->fetch(PDO::FETCH_ASSOC) ?: null;

        $items = [];

        if ($quote) {
            $quote['id']                 = (int)   $quote['id'];
            $quote['project_id']         = (int)   $quote['project_id'];
            $quote['version_num']        = (int)   $quote['version_num'];
            $quote['subtotal']           = $quote['subtotal']           !== null ? (float) $quote['subtotal']           : null;
            $quote['buffer_pct']         = $quote['buffer_pct']         !== null ? (float) $quote['buffer_pct']         : null;
            $quote['projected_bruto']    = $quote['projected_bruto']    !== null ? (float) $quote['projected_bruto']    : null;
            $quote['projected_liquido']  = $quote['projected_liquido']  !== null ? (float) $quote['projected_liquido']  : null;
            $quote['approved']           = (bool)  $quote['approved'];

            // 3. Obtener items de esta quote
            $stmtI = $conn->prepare("
                SELECT id, quote_id, task_name, est_hours, hourly_rate, line_total
                FROM   quote_items
                WHERE  quote_id = :qid
                ORDER  BY id ASC
            ");
            $stmtI->execute([':qid' => $quote['id']]);
            $items = $stmtI->fetchAll(PDO::FETCH_ASSOC);

            foreach ($items as &$item) {
                $item['id']          = (int)   $item['id'];
                $item['quote_id']    = (int)   $item['quote_id'];
                $item['est_hours']   = (float) $item['est_hours'];
                $item['hourly_rate'] = (float) $item['hourly_rate'];
                $item['line_total']  = (float) $item['line_total'];
            }
            unset($item);
        }

        echo json_encode([
            'success' => true,
            'quote'   => $quote,
            'items'   => $items,
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// POST — crear o actualizar quote + items
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'POST') {

    $input      = json_decode(file_get_contents('php://input'), true);
    $project_id = isset($input['project_id']) ? (int)   $input['project_id'] : 0;
    $buffer_pct = isset($input['buffer_pct']) ? (float) $input['buffer_pct'] : 15.00;
    $items      = isset($input['items'])      ? $input['items']              : [];

    // ── Validaciones ──────────────────────────────────────────
    if ($project_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
        exit;
    }
    if ($buffer_pct < 0 || $buffer_pct > 100) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'buffer_pct debe estar entre 0 y 100.']);
        exit;
    }
    if (!is_array($items) || count($items) === 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'items es obligatorio y debe tener al menos un elemento.']);
        exit;
    }

    // Validar cada item antes de tocar la DB
    foreach ($items as $i => $item) {
        $est_hours  = isset($item['est_hours'])  ? (float) $item['est_hours']  : 0;
        $hourly_rate = isset($item['hourly_rate']) ? (float) $item['hourly_rate'] : 0;

        if ($est_hours <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => "Item[$i]: est_hours debe ser mayor que 0."]);
            exit;
        }
        if ($hourly_rate <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => "Item[$i]: hourly_rate debe ser mayor que 0."]);
            exit;
        }
    }

    try {
        // 1. Verificar proyecto + flag has_project_eval (regla workflow V2)
        $stmtP = $conn->prepare("
            SELECT id, has_project_eval FROM proyectos WHERE id = :id
        ");
        $stmtP->execute([':id' => $project_id]);
        $proyecto = $stmtP->fetch(PDO::FETCH_ASSOC);

        if (!$proyecto) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
            exit;
        }
        if ((int) $proyecto['has_project_eval'] !== 1) {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'error'   => 'No se puede crear una cotización sin evaluación pre-proyecto completada (has_project_eval = 0).',
                'rule'    => 'crm_spec.md: create_quote requiere has_project_eval',
            ]);
            exit;
        }

        // 2. Leer retention_rate_2026 desde settings
        $retention = getRetentionRate($conn);

        // 3. Calcular totales
        $subtotal = 0.0;
        $itemsCalc = [];

        foreach ($items as $item) {
            $est_hours   = (float) $item['est_hours'];
            $hourly_rate = (float) $item['hourly_rate'];
            $line_total  = round($est_hours * $hourly_rate, 2);
            $subtotal   += $line_total;

            $itemsCalc[] = [
                'task_name'   => isset($item['task_name']) ? trim($item['task_name']) : null,
                'est_hours'   => $est_hours,
                'hourly_rate' => $hourly_rate,
                'line_total'  => $line_total,
            ];
        }

        $subtotal          = round($subtotal, 2);
        $projected_bruto   = round($subtotal * (1 + $buffer_pct / 100), 2);
        $projected_liquido = round($projected_bruto * (1 - $retention / 100), 2);

        $conn->beginTransaction();

        // 4. Upsert quotes — una sola row por project_id (UNIQUE)
        $stmtUpsert = $conn->prepare("
            INSERT INTO quotes
                (project_id, buffer_pct, subtotal, projected_bruto, projected_liquido, version_num)
            VALUES
                (:pid, :buf, :sub, :bruto, :liquido, 1)
            ON DUPLICATE KEY UPDATE
                buffer_pct         = VALUES(buffer_pct),
                subtotal           = VALUES(subtotal),
                projected_bruto    = VALUES(projected_bruto),
                projected_liquido  = VALUES(projected_liquido),
                approved           = 0,
                approved_date      = NULL,
                version_num        = version_num + 1
        ");
        $stmtUpsert->execute([
            ':pid'     => $project_id,
            ':buf'     => $buffer_pct,
            ':sub'     => $subtotal,
            ':bruto'   => $projected_bruto,
            ':liquido' => $projected_liquido,
        ]);

        // Obtener quote_id
        $quote_id = (int) $conn->lastInsertId();
        if ($quote_id === 0) {
            $stmtId = $conn->prepare("SELECT id FROM quotes WHERE project_id = :pid");
            $stmtId->execute([':pid' => $project_id]);
            $quote_id = (int) $stmtId->fetchColumn();
        }

        // 5. Reemplazar quote_items: DELETE + INSERT
        $stmtDel = $conn->prepare("DELETE FROM quote_items WHERE quote_id = :qid");
        $stmtDel->execute([':qid' => $quote_id]);

        $stmtIns = $conn->prepare("
            INSERT INTO quote_items (quote_id, task_name, est_hours, hourly_rate, line_total)
            VALUES (:qid, :task, :hours, :rate, :total)
        ");
        foreach ($itemsCalc as $item) {
            $stmtIns->execute([
                ':qid'   => $quote_id,
                ':task'  => $item['task_name'],
                ':hours' => $item['est_hours'],
                ':rate'  => $item['hourly_rate'],
                ':total' => $item['line_total'],
            ]);
        }

        $conn->commit();

        echo json_encode([
            'success'           => true,
            'message'           => 'Cotización guardada.',
            'quote_id'          => $quote_id,
            'project_id'        => $project_id,
            'subtotal'          => $subtotal,
            'buffer_pct'        => $buffer_pct,
            'projected_bruto'   => $projected_bruto,
            'projected_liquido' => $projected_liquido,
            'retention_used'    => $retention,
            'items_saved'       => count($itemsCalc),
        ]);

    } catch (PDOException $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// PATCH — aprobar quote existente
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'PATCH') {

    $quote_id = isset($_GET['quote_id']) ? (int) $_GET['quote_id'] : 0;

    if ($quote_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'quote_id es obligatorio como query param.']);
        exit;
    }

    try {
        // Verificar que la quote existe
        $stmtQ = $conn->prepare("
            SELECT id, project_id, approved, approved_date FROM quotes WHERE id = :id
        ");
        $stmtQ->execute([':id' => $quote_id]);
        $quote = $stmtQ->fetch(PDO::FETCH_ASSOC);

        if (!$quote) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Quote $quote_id no encontrada."]);
            exit;
        }

        // Idempotente: si ya estaba aprobada, retornar estado actual sin error
        if ((int) $quote['approved'] === 1) {
            echo json_encode([
                'success'       => true,
                'message'       => 'La cotización ya estaba aprobada.',
                'quote_id'      => (int) $quote['id'],
                'project_id'    => (int) $quote['project_id'],
                'approved'      => true,
                'approved_date' => $quote['approved_date'],
            ]);
            exit;
        }

        // Aprobar
        $stmtApprove = $conn->prepare("
            UPDATE quotes
            SET approved      = 1,
                approved_date = NOW()
            WHERE id = :id
        ");
        $stmtApprove->execute([':id' => $quote_id]);

        // Leer approved_date recién guardado
        $stmtDate = $conn->prepare("SELECT approved_date FROM quotes WHERE id = :id");
        $stmtDate->execute([':id' => $quote_id]);
        $approved_date = $stmtDate->fetchColumn();

        echo json_encode([
            'success'       => true,
            'message'       => 'Cotización aprobada.',
            'quote_id'      => $quote_id,
            'project_id'    => (int) $quote['project_id'],
            'approved'      => true,
            'approved_date' => $approved_date,
        ]);

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
