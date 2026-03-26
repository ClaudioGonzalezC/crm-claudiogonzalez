<?php
/**
 * /api/v2/project-eval.php
 *
 * GET  ?project_id=5
 *      Retorna la evaluación pre-proyecto, las preguntas del módulo
 *      y las respuestas ya guardadas para ese proyecto.
 *
 * POST { "project_id": 5, "score": 75, "notes": "...", "answers": [...] }
 *      Crea o actualiza la evaluación.
 *      Guarda respuestas (DELETE + INSERT por módulo).
 *      Marca proyectos.has_project_eval = 1 y proyectos.eval_score = score.
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica tablas legacy. No altera WorkflowService.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include_once '../../config/config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ─────────────────────────────────────────────────────────────
// GET — retorna eval + preguntas + respuestas del proyecto
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

        // 2. Obtener evaluación (puede no existir aún)
        $stmtE = $conn->prepare("
            SELECT id, project_id, score, notes, created_at
            FROM   project_evals
            WHERE  project_id = :pid
        ");
        $stmtE->execute([':pid' => $project_id]);
        $eval = $stmtE->fetch(PDO::FETCH_ASSOC) ?: null;

        if ($eval) {
            $eval['score'] = (int) $eval['score'];
        }

        // 3. Obtener todas las preguntas del módulo project_eval
        $stmtQ = $conn->prepare("
            SELECT id, question, type, weight, order_num
            FROM   questions
            WHERE  module = 'project_eval'
            ORDER  BY order_num ASC, id ASC
        ");
        $stmtQ->execute();
        $questions = $stmtQ->fetchAll(PDO::FETCH_ASSOC);

        foreach ($questions as &$q) {
            $q['id']        = (int) $q['id'];
            $q['weight']    = (int) $q['weight'];
            $q['order_num'] = (int) $q['order_num'];
        }
        unset($q);

        // 4. Obtener respuestas del proyecto filtradas por preguntas de este módulo
        $answers = [];
        if (!empty($questions)) {
            $qIds        = array_column($questions, 'id');
            $placeholders = implode(',', array_fill(0, count($qIds), '?'));

            $stmtA = $conn->prepare("
                SELECT id, project_id, question_id, answer_value, answer_notes, created_at
                FROM   answers
                WHERE  project_id   = ?
                  AND  question_id  IN ($placeholders)
                ORDER  BY question_id ASC
            ");
            $stmtA->execute(array_merge([$project_id], $qIds));
            $answers = $stmtA->fetchAll(PDO::FETCH_ASSOC);

            foreach ($answers as &$a) {
                $a['id']          = (int) $a['id'];
                $a['project_id']  = (int) $a['project_id'];
                $a['question_id'] = (int) $a['question_id'];
            }
            unset($a);
        }

        echo json_encode([
            'success'   => true,
            'eval'      => $eval,
            'questions' => $questions,
            'answers'   => $answers,
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
    }

// ─────────────────────────────────────────────────────────────
// POST — crear o actualizar evaluación + respuestas
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'POST') {

    $input      = json_decode(file_get_contents('php://input'), true);
    $project_id = isset($input['project_id']) ? (int) $input['project_id']  : 0;
    $score      = isset($input['score'])      ? (int) $input['score']        : null;
    $notes      = isset($input['notes'])      ? trim($input['notes'])        : null;
    $answers    = isset($input['answers'])    ? $input['answers']            : [];

    // Validación básica
    if ($project_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
        exit;
    }
    if ($score === null || $score < 0 || $score > 100) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'score es obligatorio y debe estar entre 0 y 100.']);
        exit;
    }
    if (!is_array($answers)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'answers debe ser un array.']);
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

        $conn->beginTransaction();

        // 2. Upsert project_evals
        //    project_id tiene UNIQUE → ON DUPLICATE KEY UPDATE
        $stmtUpsert = $conn->prepare("
            INSERT INTO project_evals (project_id, score, notes)
            VALUES (:pid, :score, :notes)
            ON DUPLICATE KEY UPDATE
                score      = VALUES(score),
                notes      = VALUES(notes)
        ");
        $stmtUpsert->execute([
            ':pid'   => $project_id,
            ':score' => $score,
            ':notes' => $notes,
        ]);

        // Obtener el id del registro (nuevo o existente)
        $eval_id = (int) $conn->lastInsertId();
        if ($eval_id === 0) {
            // Era un UPDATE — recuperar el id existente
            $stmtId = $conn->prepare("SELECT id FROM project_evals WHERE project_id = :pid");
            $stmtId->execute([':pid' => $project_id]);
            $eval_id = (int) $stmtId->fetchColumn();
        }

        // 3. Reemplazar respuestas del módulo project_eval para este proyecto
        //    Obtener IDs de preguntas del módulo
        $stmtQids = $conn->query("SELECT id FROM questions WHERE module = 'project_eval'");
        $evalQids = $stmtQids->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($evalQids)) {
            $placeholders = implode(',', array_fill(0, count($evalQids), '?'));
            $stmtDel = $conn->prepare("
                DELETE FROM answers
                WHERE  project_id  = ?
                  AND  question_id IN ($placeholders)
            ");
            $stmtDel->execute(array_merge([$project_id], $evalQids));
        }

        // 4. Insertar respuestas nuevas (solo las que pertenezcan al módulo)
        $evalQidSet  = array_flip($evalQids); // para lookup O(1)
        $stmtIns     = $conn->prepare("
            INSERT INTO answers (project_id, question_id, answer_value, answer_notes)
            VALUES (:pid, :qid, :val, :notes)
        ");
        $inserted = 0;

        foreach ($answers as $ans) {
            $qid = isset($ans['question_id']) ? (int) $ans['question_id'] : 0;
            if ($qid <= 0 || !isset($evalQidSet[$qid])) {
                continue; // ignorar preguntas de otro módulo o inválidas
            }
            $stmtIns->execute([
                ':pid'   => $project_id,
                ':qid'   => $qid,
                ':val'   => isset($ans['answer_value']) ? (string) $ans['answer_value'] : null,
                ':notes' => isset($ans['answer_notes']) ? trim($ans['answer_notes'])   : null,
            ]);
            $inserted++;
        }

        // 5. Marcar proyecto: has_project_eval = 1, eval_score = score
        $stmtFlag = $conn->prepare("
            UPDATE proyectos
            SET has_project_eval = 1,
                eval_score       = :score
            WHERE id = :id
        ");
        $stmtFlag->execute([':score' => $score, ':id' => $project_id]);

        $conn->commit();

        echo json_encode([
            'success'          => true,
            'message'          => 'Evaluación pre-proyecto guardada.',
            'eval_id'          => $eval_id,
            'project_id'       => $project_id,
            'score'            => $score,
            'answers_saved'    => $inserted,
            'has_project_eval' => 1,
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
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Usa GET o POST.']);
}
?>
