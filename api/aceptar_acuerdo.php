<?php
// Permitir acceso desde el frontend
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/config.php';

// Zona horaria de Chile — evita que MySQL use NOW() en UTC
date_default_timezone_set('America/Santiago');

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->proyecto_id)) {
    try {
        // Fecha generada en PHP con TZ correcta, en formato DATETIME para MySQL
        $fecha_aceptacion = date('Y-m-d H:i:s');

        $query = "UPDATE proyectos SET
                  terminos_aceptados = 1,
                  fecha_aceptacion   = :fa,
                  ip_aceptacion      = :ip
                  WHERE id = :id";

        $stmt = $conn->prepare($query);

        $ip = $_SERVER['REMOTE_ADDR'];

        $stmt->bindParam(':fa', $fecha_aceptacion);
        $stmt->bindParam(':ip', $ip);
        $stmt->bindParam(':id', $data->proyecto_id);

        if ($stmt->execute()) {
            echo json_encode([
                "success"          => true,
                "message"          => "Acuerdo aceptado",
                "fecha_aceptacion" => $fecha_aceptacion, // devolvemos la fecha para que el frontend la use sin refetch
            ]);
        } else {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "No se pudo actualizar la base de datos"]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Falta el ID del proyecto"]);
}
?>