<?php
include_once '../config/config.php';
header('Content-Type: application/json');

// 1. Capturamos la entrada
$json = file_get_contents('php://input');
$data = json_decode($json);

$usuarioInput = $data->usuario ?? '';
$passwordInput = $data->password ?? '';

try {
    // 2. Buscamos el usuario
    $stmt = $conn->prepare("SELECT * FROM usuarios WHERE usuario = ?");
    $stmt->execute([$usuarioInput]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // 3. Lógica de respuesta con "Soplón" de errores
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "debug" => "El usuario '$usuarioInput' no fue encontrado en la tabla 'usuarios'."
        ]);
        exit;
    }

    // Verificamos el hash
    $esValida = password_verify($passwordInput, $user['password']);

    if ($esValida) {
        // RESPUESTA DE ÉXITO: Estructura compatible con AuthContext de React
        echo json_encode([
            "status" => "success",
            "token" => bin2hex(random_bytes(16)),
            "user" => [
                "id" => (int)$user['id'],
                "nombre" => $user['nombre'],
                "usuario" => $user['usuario'],
                "rol" => $user['rol'] // <--- ESTO ES LO QUE ACTIVA LA PESTAÑA DE ADMIN
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "debug" => "Usuario encontrado, pero password_verify falló.",
            "longitud_hash_db" => strlen($user['password']),
            "hash_db_inicio" => substr($user['password'], 0, 10)
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}