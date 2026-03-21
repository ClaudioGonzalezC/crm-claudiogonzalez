<?php
include_once '../config/config.php';
header('Content-Type: application/json');
header("Cache-Control: no-cache, no-store, must-revalidate");

$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['proyecto_id'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "proyecto_id requerido"]);
    exit;
}

$proyecto_id = (int)$data['proyecto_id'];

// Lista blanca de preferencias permitidas con su tipo
$camposPermitidos = [
    'mostrar_seguimiento_tiempo' => 'bool',
];

$sets    = [];
$params  = [':id' => $proyecto_id];
$updates = [];  // Para devolver al frontend

foreach ($camposPermitidos as $campo => $tipo) {
    if (!array_key_exists($campo, $data)) continue;

    $valor = $tipo === 'bool'
        ? ($data[$campo] ? 1 : 0)
        : (int)$data[$campo];

    $sets[]            = "`{$campo}` = :{$campo}";
    $params[":{$campo}"] = $valor;
    $updates[$campo]   = (bool)$valor;
}

if (empty($sets)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "No hay campos válidos para actualizar"]);
    exit;
}

try {
    $query = "UPDATE proyectos SET " . implode(', ', $sets) . " WHERE id = :id";
    $stmt  = $conn->prepare($query);
    $stmt->execute($params);

    echo json_encode([
        "status"  => "success",
        "message" => "Preferencias actualizadas",
        "updated" => $updates,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}