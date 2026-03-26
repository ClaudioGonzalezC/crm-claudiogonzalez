<?php
/**
 * /api/v2/expenses.php
 *
 * GET    ?project_id=X
 *        Lista gastos del proyecto + total + status_v2 + profit_calculated.
 *
 * POST   { project_id, expense_name, amount, expense_date, category, notes? }
 *        Crea un gasto. Resetea proyectos.profit_calculated = 0 y net_profit = NULL.
 *
 * PATCH  ?expense_id=X  { expense_name?, amount?, category?, notes? }
 *        Edita campos permitidos. project_id y expense_date son inmutables.
 *        Resetea proyectos.profit_calculated = 0 y net_profit = NULL.
 *
 * DELETE ?expense_id=X
 *        Elimina el gasto. Resetea proyectos.profit_calculated = 0 y net_profit = NULL.
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica status_v2. No llama WorkflowService. No toca endpoints anteriores.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include_once '../../config/config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ENUM oficial según crm_spec.md
const CATEGORY_VALID = ['Herramientas', 'Licencias', 'Subcontratista', 'Viajes', 'Otro'];

// ─────────────────────────────────────────────────────────────
// HELPER — invalidar profit cuando cambian expenses
// Resetea profit_calculated = 0 Y net_profit = NULL
// ─────────────────────────────────────────────────────────────
function invalidateProfit(PDO $conn, int $project_id): void
{
    $stmt = $conn->prepare("
        UPDATE proyectos
        SET    profit_calculated = 0,
               net_profit        = NULL
        WHERE  id = :id
    ");
    $stmt->execute([':id' => $project_id]);
}

// ─────────────────────────────────────────────────────────────
// HELPER — verificar que el proyecto existe
// ─────────────────────────────────────────────────────────────
function fetchProyecto(PDO $conn, int $project_id): ?array
{
    $stmt = $conn->prepare("
        SELECT id, status_v2, profit_calculated, net_profit
        FROM   proyectos
        WHERE  id = :id
    ");
    $stmt->execute([':id' => $project_id]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

// ─────────────────────────────────────────────────────────────
// GET — lista gastos del proyecto
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

        $stmt = $conn->prepare("
            SELECT id, project_id, expense_name, amount,
                   expense_date, category, notes, created_at
            FROM   project_expenses
            WHERE  project_id = :pid
            ORDER  BY expense_date ASC, id ASC
        ");
        $stmt->execute([':pid' => $project_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $total = 0.0;
        foreach ($rows as &$e) {
            $e['id']         = (int)   $e['id'];
            $e['project_id'] = (int)   $e['project_id'];
            $e['amount']     = (float) $e['amount'];
            $total          += $e['amount'];
        }
        unset($e);

        echo json_encode([
            'success'          => true,
            'project_id'       => $project_id,
            'status_v2'        => $proyecto['status_v2'],
            'profit_calculated'=> (bool) $proyecto['profit_calculated'],
            'expenses'         => $rows,
            'total_expenses'   => round($total, 2),
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// POST — crear gasto
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'POST') {

    $input        = json_decode(file_get_contents('php://input'), true);
    $project_id   = isset($input['project_id'])   ? (int)    $input['project_id']   : 0;
    $expense_name = isset($input['expense_name']) ? trim($input['expense_name'])     : '';
    $amount       = isset($input['amount'])       ? (float)  $input['amount']        : 0;
    $expense_date = isset($input['expense_date']) ? trim($input['expense_date'])     : '';
    $category     = isset($input['category'])     ? trim($input['category'])         : '';
    $notes        = isset($input['notes'])        ? trim($input['notes'])            : null;

    // ── Validaciones ──────────────────────────────────────────
    if ($project_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
        exit;
    }
    if ($expense_name === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'expense_name es obligatorio.']);
        exit;
    }
    if ($amount <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'amount debe ser mayor que 0.']);
        exit;
    }
    if ($expense_date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expense_date)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'expense_date es obligatorio (YYYY-MM-DD).']);
        exit;
    }
    if (!in_array($category, CATEGORY_VALID, true)) {
        http_response_code(422);
        echo json_encode([
            'success'      => false,
            'error'        => "category '$category' no válida.",
            'valid_values' => CATEGORY_VALID,
        ]);
        exit;
    }

    try {
        $proyecto = fetchProyecto($conn, $project_id);
        if (!$proyecto) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Proyecto $project_id no encontrado."]);
            exit;
        }

        $conn->beginTransaction();

        // Insertar gasto
        $stmt = $conn->prepare("
            INSERT INTO project_expenses
                (project_id, expense_name, amount, expense_date, category, notes)
            VALUES
                (:pid, :name, :amount, :date, :cat, :notes)
        ");
        $stmt->execute([
            ':pid'    => $project_id,
            ':name'   => $expense_name,
            ':amount' => $amount,
            ':date'   => $expense_date,
            ':cat'    => $category,
            ':notes'  => $notes ?: null,
        ]);

        $expense_id = (int) $conn->lastInsertId();

        // Invalidar profit
        invalidateProfit($conn, $project_id);

        $conn->commit();

        echo json_encode([
            'success'           => true,
            'message'           => 'Gasto registrado.',
            'expense_id'        => $expense_id,
            'project_id'        => $project_id,
            'profit_invalidated'=> true,
        ]);

    } catch (PDOException $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// PATCH — editar gasto (solo campos permitidos)
// Campos inmutables: project_id, expense_date
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'PATCH') {

    $expense_id = isset($_GET['expense_id']) ? (int) $_GET['expense_id'] : 0;

    if ($expense_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'expense_id es obligatorio como query param.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    // Rechazar explícitamente campos inmutables si alguien los envía
    if (isset($input['project_id']) || isset($input['expense_date'])) {
        http_response_code(422);
        echo json_encode([
            'success'          => false,
            'error'            => 'project_id y expense_date no son modificables.',
            'editable_fields'  => ['expense_name', 'amount', 'category', 'notes'],
        ]);
        exit;
    }

    try {
        // Verificar que el gasto existe y obtener project_id
        $stmtE = $conn->prepare("
            SELECT id, project_id, expense_name, amount, category, notes
            FROM   project_expenses
            WHERE  id = :id
        ");
        $stmtE->execute([':id' => $expense_id]);
        $expense = $stmtE->fetch(PDO::FETCH_ASSOC);

        if (!$expense) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Gasto $expense_id no encontrado."]);
            exit;
        }

        // Resolver valores finales (solo actualizar lo que llegó)
        $new_name     = isset($input['expense_name']) ? trim($input['expense_name'])    : $expense['expense_name'];
        $new_amount   = isset($input['amount'])       ? (float) $input['amount']        : (float) $expense['amount'];
        $new_category = isset($input['category'])     ? trim($input['category'])        : $expense['category'];
        $new_notes    = array_key_exists('notes', $input) ? trim($input['notes'])       : $expense['notes'];

        // Validar campos editados
        if ($new_name === '') {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'expense_name no puede estar vacío.']);
            exit;
        }
        if ($new_amount <= 0) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'amount debe ser mayor que 0.']);
            exit;
        }
        if (!in_array($new_category, CATEGORY_VALID, true)) {
            http_response_code(422);
            echo json_encode([
                'success'      => false,
                'error'        => "category '$new_category' no válida.",
                'valid_values' => CATEGORY_VALID,
            ]);
            exit;
        }

        $conn->beginTransaction();

        $stmtU = $conn->prepare("
            UPDATE project_expenses
            SET    expense_name = :name,
                   amount       = :amount,
                   category     = :cat,
                   notes        = :notes
            WHERE  id = :id
        ");
        $stmtU->execute([
            ':name'   => $new_name,
            ':amount' => $new_amount,
            ':cat'    => $new_category,
            ':notes'  => $new_notes ?: null,
            ':id'     => $expense_id,
        ]);

        // Invalidar profit del proyecto
        invalidateProfit($conn, (int) $expense['project_id']);

        $conn->commit();

        echo json_encode([
            'success'           => true,
            'message'           => 'Gasto actualizado.',
            'expense_id'        => $expense_id,
            'project_id'        => (int) $expense['project_id'],
            'profit_invalidated'=> true,
        ]);

    } catch (PDOException $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// DELETE — eliminar gasto
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'DELETE') {

    $expense_id = isset($_GET['expense_id']) ? (int) $_GET['expense_id'] : 0;

    if ($expense_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'expense_id es obligatorio como query param.']);
        exit;
    }

    try {
        // Leer project_id antes de eliminar
        $stmtE = $conn->prepare("SELECT id, project_id FROM project_expenses WHERE id = :id");
        $stmtE->execute([':id' => $expense_id]);
        $expense = $stmtE->fetch(PDO::FETCH_ASSOC);

        if (!$expense) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Gasto $expense_id no encontrado."]);
            exit;
        }

        $conn->beginTransaction();

        $stmtD = $conn->prepare("DELETE FROM project_expenses WHERE id = :id");
        $stmtD->execute([':id' => $expense_id]);

        // Invalidar profit del proyecto
        invalidateProfit($conn, (int) $expense['project_id']);

        $conn->commit();

        echo json_encode([
            'success'           => true,
            'message'           => 'Gasto eliminado.',
            'expense_id'        => $expense_id,
            'project_id'        => (int) $expense['project_id'],
            'profit_invalidated'=> true,
        ]);

    } catch (PDOException $e) {
        $conn->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// Método no soportado
// ─────────────────────────────────────────────────────────────
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Usa GET, POST, PATCH o DELETE.']);
}
?>
