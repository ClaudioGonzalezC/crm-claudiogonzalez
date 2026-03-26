<?php
/**
 * /api/v2/emotional-eval.php
 *
 * GET  ?project_id=5
 *      Retorna la evaluación emocional, las preguntas del módulo 'emotional'
 *      y las respuestas ya guardadas para ese proyecto.
 *
 * POST {
 *        "project_id":        5,
 *        "satisfaction_score": 8.0,
 *        "stress_level":       6.5,
 *        "client_conflicts":   false,
 *        "would_repeat":       true,
 *        "learning_outcome":  "Aprendí a negociar mejor los plazos.",
 *        "final_notes":       "Buen proyecto en general.",
 *        "answers":           [{ "question_id": 3, "answer_value": "8", "answer_notes": "" }]
 *      }
 *      Crea o actualiza la evaluación emocional.
 *      Actualiza proyectos.stress_score = stress_level.
 *      Marca proyectos.emotional_eval_completed = 1.
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica tablas legacy. No altera endpoints anteriores.
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
// GET — retorna eval emocional + preguntas + respuestas
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

        // 2. Obtener evaluación emocional (puede no existir aún)
        $stmtE = $conn->prepare("
            SELECT id, project_id,
                   satisfaction_score, stress_level,
                   client_conflicts, would_repeat,
                   learning_outcome, final_notes,
                   created_at
            FROM   emotional_evals
            WHERE  project_id = :pid
        ");
        $stmtE->execute([':pid' => $project_id]);
        $eval = $stmtE->fetch(PDO::FETCH_ASSOC) ?: null;

        if ($eval) {
            $eval['id']                  = (int)   $eval['id'];
            $eval['project_id']          = (int)   $eval['project_id'];
            $eval['satisfaction_score']  = $eval['satisfaction_score']  !== null ? (float) $eval['satisfaction_score']  : null;
            $eval['stress_level']        = $eval['stress_level']        !== null ? (float) $eval['stress_level']        : null;
            $eval['client_conflicts']    = (bool)  $eval['client_conflicts'];
            $eval['would_repeat']        = (bool)  $eval['would_repeat'];
        }

        // 3. Obtener preguntas del módulo 'emotional'
        $stmtQ = $conn->prepare("
            SELECT id, question, type, weight, order_num
            FROM   questions
            WHERE  module = 'emotional'
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

        // 4. Obtener respuestas del proyecto para preguntas de este módulo
        $answers = [];
        if (!empty($questions)) {
            $qIds         = array_column($questions, 'id');
            $placeholders = implode(',', array_fill(0, count($qIds), '?'));

            $stmtA = $conn->prepare("
                SELECT id, project_id, question_id, answer_value, answer_notes, created_at
                FROM   answers
                WHERE  project_id  = ?
                  AND  question_id IN ($placeholders)
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
// POST — crear o actualizar evaluación emocional
// ─────────────────────────────────────────────────────────────
} elseif ($method === 'POST') {

    $input = json_decode(file_get_contents('php://input'), true);

    $project_id         = isset($input['project_id'])         ? (int)   $input['project_id']          : 0;
    $satisfaction_score = isset($input['satisfaction_score']) ? (float) $input['satisfaction_score']   : null;
    $stress_level       = isset($input['stress_level'])       ? (float) $input['stress_level']         : null;
    $client_conflicts   = isset($input['client_conflicts'])   ? (bool)  $input['client_conflicts']     : false;
    $would_repeat       = isset($input['would_repeat'])       ? (bool)  $input['would_repeat']         : false;
    $learning_outcome   = isset($input['learning_outcome'])   ? trim($input['learning_outcome'])       : null;
    $final_notes        = isset($input['final_notes'])        ? trim($input['final_notes'])             : null;
    $answers            = isset($input['answers'])            ? $input['answers']                      : [];

    // ── Validaciones ──────────────────────────────────────────
    if ($project_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'project_id es obligatorio.']);
        exit;
    }
    if ($satisfaction_score === null || $satisfaction_score < 0 || $satisfaction_score > 10) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'satisfaction_score es obligatorio y debe estar entre 0.0 y 10.0.']);
        exit;
    }
    if ($stress_level === null || $stress_level < 0 || $stress_level > 10) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'stress_level es obligatorio y debe estar entre 0.0 y 10.0.']);
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

        // 2. Upsert emotional_evals
        //    project_id tiene UNIQUE → ON DUPLICATE KEY UPDATE
        $stmtUpsert = $conn->prepare("
            INSERT INTO emotional_evals
                (project_id, satisfaction_score, stress_level,
                 client_conflicts, would_repeat, learning_outcome, final_notes)
            VALUES
                (:pid, :sat, :stress, :conflicts, :repeat, :learning, :notes)
            ON DUPLICATE KEY UPDATE
                satisfaction_score = VALUES(satisfaction_score),
                stress_level       = VALUES(stress_level),
                client_conflicts   = VALUES(client_conflicts),
                would_repeat       = VALUES(would_repeat),
                learning_outcome   = VALUES(learning_outcome),
                final_notes        = VALUES(final_notes)
        ");
        $stmtUpsert->execute([
            ':pid'       => $project_id,
            ':sat'       => $satisfaction_score,
            ':stress'    => $stress_level,
            ':conflicts' => (int) $client_conflicts,
            ':repeat'    => (int) $would_repeat,
            ':learning'  => $learning_outcome,
            ':notes'     => $final_notes,
        ]);

        // Obtener eval_id (nuevo o existente)
        $eval_id = (int) $conn->lastInsertId();
        if ($eval_id === 0) {
            $stmtId = $conn->prepare("SELECT id FROM emotional_evals WHERE project_id = :pid");
            $stmtId->execute([':pid' => $project_id]);
            $eval_id = (int) $stmtId->fetchColumn();
        }

        // 3. Reemplazar respuestas del módulo 'emotional' para este proyecto
        $stmtQids     = $conn->query("SELECT id FROM questions WHERE module = 'emotional'");
        $emotionalQids = $stmtQids->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($emotionalQids)) {
            $placeholders = implode(',', array_fill(0, count($emotionalQids), '?'));
            $stmtDel = $conn->prepare("
                DELETE FROM answers
                WHERE  project_id  = ?
                  AND  question_id IN ($placeholders)
            ");
            $stmtDel->execute(array_merge([$project_id], $emotionalQids));
        }

        // 4. Insertar respuestas nuevas (solo preguntas del módulo 'emotional')
        $emotionalQidSet = array_flip($emotionalQids);
        $stmtIns = $conn->prepare("
            INSERT INTO answers (project_id, question_id, answer_value, answer_notes)
            VALUES (:pid, :qid, :val, :notes)
        ");
        $inserted = 0;

        foreach ($answers as $ans) {
            $qid = isset($ans['question_id']) ? (int) $ans['question_id'] : 0;
            if ($qid <= 0 || !isset($emotionalQidSet[$qid])) {
                continue;
            }
            $stmtIns->execute([
                ':pid'   => $project_id,
                ':qid'   => $qid,
                ':val'   => isset($ans['answer_value']) ? (string) $ans['answer_value'] : null,
                ':notes' => isset($ans['answer_notes']) ? trim($ans['answer_notes'])   : null,
            ]);
            $inserted++;
        }

        // 5. Marcar proyecto:
        //    emotional_eval_completed = 1
        //    stress_score = stress_level  (crm_spec.md: stress_score en proyectos)
        $stmtFlag = $conn->prepare("
            UPDATE proyectos
            SET emotional_eval_completed = 1,
                stress_score             = :stress
            WHERE id = :id
        ");
        $stmtFlag->execute([':stress' => $stress_level, ':id' => $project_id]);

        $conn->commit();

        echo json_encode([
            'success'                    => true,
            'message'                    => 'Evaluación emocional guardada.',
            'eval_id'                    => $eval_id,
            'project_id'                 => $project_id,
            'stress_score'               => $stress_level,
            'answers_saved'              => $inserted,
            'emotional_eval_completed'   => 1,
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
