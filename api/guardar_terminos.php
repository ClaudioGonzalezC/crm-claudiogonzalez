<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');
include_once '../config/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['proyecto_id']) || !isset($data['terminos_condiciones'])) {
        throw new Exception("Datos incompletos");
    }

    $query = "UPDATE proyectos SET terminos_condiciones = :terminos WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':terminos', $data['terminos_condiciones']);
    $stmt->bindParam(':id', $data['proyecto_id'], PDO::PARAM_INT);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Términos actualizados"]);
    } else {
        throw new Exception("Error al ejecutar la actualización");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}