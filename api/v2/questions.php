<?php
/**
 * /api/v2/questions.php
 *
 * GET ?module=project_eval   → preguntas del módulo de evaluación pre-proyecto
 * GET ?module=emotional       → preguntas del módulo de evaluación emocional
 * GET (sin módulo)            → todas las preguntas de todos los módulos
 *
 * Orden: order_num ASC, id ASC
 *
 * Source of truth: /docs/crm_spec.md
 * Solo lectura. No modifica DB. No toca endpoints anteriores.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Usa GET.']);
    exit;
}

include_once '../../config/config.php';

// Módulos válidos según crm_spec.md ENUM questions.module
const VALID_MODULES = ['project_eval', 'emotional'];

$module = isset($_GET['module']) ? trim($_GET['module']) : null;

// Validar módulo si fue enviado
if ($module !== null && !in_array($module, VALID_MODULES, true)) {
    http_response_code(422);
    echo json_encode([
        'success'        => false,
        'error'          => "Módulo '$module' no válido.",
        'valid_modules'  => VALID_MODULES,
    ]);
    exit;
}

try {
    if ($module !== null) {
        // Preguntas de un módulo específico
        $stmt = $conn->prepare("
            SELECT id, module, question, type, weight, order_num
            FROM   questions
            WHERE  module = :module
            ORDER  BY order_num ASC, id ASC
        ");
        $stmt->execute([':module' => $module]);
    } else {
        // Todas las preguntas, agrupadas por módulo en el orden canónico
        $stmt = $conn->prepare("
            SELECT id, module, question, type, weight, order_num
            FROM   questions
            ORDER  BY module ASC, order_num ASC, id ASC
        ");
        $stmt->execute();
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Normalizar tipos
    foreach ($rows as &$q) {
        $q['id']        = (int) $q['id'];
        $q['weight']    = (int) $q['weight'];
        $q['order_num'] = (int) $q['order_num'];
    }
    unset($q);

    echo json_encode([
        'success'   => true,
        'module'    => $module,           // null = todos
        'count'     => count($rows),
        'questions' => $rows,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
}
?>
