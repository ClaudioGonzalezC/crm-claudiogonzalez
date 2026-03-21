<?php
include_once '../config/config.php';
header('Content-Type: application/json');

// Capturamos el ID enviado por Builder { "id": X }
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id)) {
    try {
        $query = "DELETE FROM bitacora_horas WHERE id = :id";
        $stmt = $conn->prepare($query);
        $stmt->execute([':id' => (int)$data->id]);
        
        // Verificamos si realmente se eliminó algo
        if ($stmt->rowCount() > 0) {
            echo json_encode([
                "status" => "success", 
                "message" => "Registro de tiempo eliminado correctamente"
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                "status" => "error", 
                "message" => "No se encontró el registro con ID: " . $data->id
            ]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "status" => "error", 
            "message" => "Error al eliminar: " . $e->getMessage()
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode([
        "status" => "error", 
        "message" => "ID de registro no proporcionado"
    ]);
}