<?php
include_once '../config/config.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"));

// Builder ahora envía { "id": X }
if (!empty($data->id)) {
    try {
        $query = "DELETE FROM pagos_proyectos WHERE id = :id";
        $stmt = $conn->prepare($query);
        $result = $stmt->execute([':id' => (int)$data->id]);
        
        // Verificamos si realmente se eliminó una fila
        if ($stmt->rowCount() > 0) {
            echo json_encode(["status" => "success", "message" => "Pago eliminado correctamente"]);
        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "No se encontró el pago con ID: " . $data->id]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        // Si el error es por Foreign Keys, aquí lo dirá
        echo json_encode([
            "status" => "error", 
            "message" => "Error de base de datos: " . $e->getMessage(),
            "code" => $e->getCode()
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID no proporcionado o formato incorrecto"]);
}