<?php
include_once '../config/config.php';
header('Content-Type: application/json');

// 1. Obtener datos del frontend (Builder enviará esto)
$data = json_decode(file_get_contents("php://input"));

// Validación de campos obligatorios
if (!$data || empty($data->usuario_id) || empty($data->usuario) || empty($data->nombre)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID, Nombre y Usuario son obligatorios"]);
    exit;
}

try {
    $userId = (int)$data->usuario_id;

    // 2. Buscar al usuario específico por ID (No por LIMIT 1)
    $stmt = $conn->prepare("SELECT id, password, rol FROM usuarios WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        throw new Exception("Usuario no encontrado en el sistema.");
    }

    $nuevoHash = $user['password']; // Por defecto mantenemos la clave actual

    // 3. Lógica de Cambio de Contraseña (Solo si el usuario envía ambos campos)
    if (!empty($data->passwordActual) && !empty($data->passwordNueva)) {
        // Verificar si la contraseña actual proporcionada es correcta
        if (password_verify($data->passwordActual, $user['password'])) {
            // Generar nuevo hash seguro
            $nuevoHash = password_hash($data->passwordNueva, PASSWORD_BCRYPT);
        } else {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "La contraseña actual es incorrecta"]);
            exit;
        }
    }

    // 4. Ejecutar la actualización quirúrgica
    $sql = "UPDATE usuarios SET nombre = :nombre, usuario = :usuario, password = :pass WHERE id = :id";
    $updateStmt = $conn->prepare($sql);
    $updateStmt->execute([
        ':nombre'  => $data->nombre,
        ':usuario' => $data->usuario,
        ':pass'    => $nuevoHash,
        ':id'      => $userId
    ]);

    // 5. Respuesta para que React actualice el estado local
    echo json_encode([
        "status" => "success", 
        "message" => "¡Perfil actualizado con éxito!",
        "user" => [
            "nombre" => $data->nombre, 
            "usuario" => $data->usuario,
            "rol"    => $user['rol'] // Mantenemos el rol para no romper el AuthContext
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}