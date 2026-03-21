<?php
include_once '../config/config.php';

// Builder.io suele enviar el ID por parámetro URL (?id=X) o en el cuerpo JSON
$id = isset($_GET['id']) ? $_GET['id'] : json_decode(file_get_contents("php://input"))->id;

if (!empty($id)) {
    try {
        $query = "DELETE FROM clientes WHERE id = :id";
        $stmt = $conn->prepare($query);
        $stmt->bindParam(":id", $id);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Cliente eliminado"]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID no proporcionado"]);
}
?>