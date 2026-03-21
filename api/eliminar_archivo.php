<?php
include_once '../config/config.php';
header('Content-Type: application/json');

// 1. Obtener el ID del archivo desde el frontend
$data = json_decode(file_get_contents('php://input'));
$archivo_id = $data->id ?? null;

if (!$archivo_id) {
    echo json_encode(["status" => "error", "message" => "ID no proporcionado"]);
    exit;
}

try {
    // 2. Obtener la ruta guardada en la columna 'nombre_servidor'
    $stmt = $conn->prepare("SELECT nombre_servidor FROM archivos WHERE id = ?");
    $stmt->execute([$archivo_id]);
    $archivo = $stmt->fetch();

    if ($archivo) {
        // nombre_servidor ya contiene "uploads/Cliente/p12/archivo.pdf"
        // Necesitamos la ruta física real: usamos dirname(__DIR__) para ir a la raíz
        $ruta_fisica = dirname(__DIR__) . "/" . $archivo['nombre_servidor'];

        // 3. Borrar el archivo físico si existe
        if (file_exists($ruta_fisica)) {
            unlink($ruta_fisica);
        }

        // 4. Borrar el registro de la base de datos
        $stmt = $conn->prepare("DELETE FROM archivos WHERE id = ?");
        $stmt->execute([$archivo_id]);

        echo json_encode(["status" => "success", "message" => "Archivo eliminado del servidor y BD"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Archivo no encontrado en la base de datos"]);
    }
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}