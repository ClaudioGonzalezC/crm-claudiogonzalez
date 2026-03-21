<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

include_once '../config/config.php';
header('Content-Type: application/json');

date_default_timezone_set('America/Santiago');

try {
    $proyecto_id = $_POST['proyecto_id'] ?? null;
    if (!$proyecto_id || !isset($_FILES['archivo'])) {
        throw new Exception("Datos incompletos: Proyecto ID o Archivo ausente.");
    }

    $base_uploads = dirname(__DIR__) . "/uploads";
    if (!is_dir($base_uploads)) {
        if (!mkdir($base_uploads, 0755, true)) {
            throw new Exception("No se pudo crear la carpeta raíz /uploads.");
        }
    }

    $stmt = $conn->prepare(
        "SELECT c.nombre_empresa as cliente_nombre
         FROM proyectos p JOIN clientes c ON p.cliente_id = c.id
         WHERE p.id = ?"
    );
    $stmt->execute([$proyecto_id]);
    $cliente = $stmt->fetch();

    if (!$cliente) {
        throw new Exception("No se encontró el cliente asociado al proyecto ID: $proyecto_id");
    }

    $nombre_cliente_limpio = preg_replace('/[^a-zA-Z0-9_-]/', '_', $cliente['cliente_nombre']);

    $folder_relativo  = "uploads/" . $nombre_cliente_limpio . "/p" . $proyecto_id . "/";
    $ruta_completa    = dirname(__DIR__) . "/" . $folder_relativo;

    if (!is_dir($ruta_completa)) {
        if (!mkdir($ruta_completa, 0755, true)) {
            throw new Exception("Error al crear subcarpeta: " . $folder_relativo);
        }
    }

    $file            = $_FILES['archivo'];
    $nombre_original = basename($file['name']);
    $nombre_seguro   = time() . "_" . preg_replace('/[^a-zA-Z0-9._-]/', '_', $nombre_original);
    $destino_final   = $ruta_completa . $nombre_seguro;

    if (move_uploaded_file($file['tmp_name'], $destino_final)) {
        $fecha_subida = date('Y-m-d H:i:s'); // America/Santiago ya activo

        $stmt = $conn->prepare(
            "INSERT INTO archivos
                (proyecto_id, nombre_archivo, nombre_servidor, tipo_mime, peso_bytes, fecha_subida)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $proyecto_id,
            $nombre_original,
            $folder_relativo . $nombre_seguro,
            $file['type'],
            $file['size'],
            $fecha_subida,
        ]);

        echo json_encode(["status" => "success", "message" => "Archivo guardado con éxito"]);
    } else {
        throw new Exception("No se pudo mover el archivo al destino final.");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>