<?php
include_once '../config/config.php';
$data = json_decode(file_get_contents("php://input"));

try {
    $query = "UPDATE proyectos SET revisiones_usadas = :rev WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->execute([':rev' => $data->revisiones_usadas, ':id' => $data->id]);
    echo json_encode(["status" => "success"]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>