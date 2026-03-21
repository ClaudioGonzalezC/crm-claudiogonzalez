<?php
include_once '../config/config.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->usuario) && !empty($data->password)) {
    $stmt = $conn->prepare("SELECT * FROM usuarios WHERE usuario = ? LIMIT 1");
    $stmt->execute([$data->usuario]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($data->password, $user['password'])) {
        echo json_encode([
            "status" => "success",
            "token" => bin2hex(random_bytes(32)),
            "user" => [
                "id" => $user['id'],
                "nombre" => $user['nombre'],
                "rol" => $user['rol'] // <--- CLAVE PARA LOS PERMISOS
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "Credenciales incorrectas"]);
    }
}