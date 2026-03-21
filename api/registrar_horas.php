<?php
include_once '../config/config.php';
header('Content-Type: application/json');

// TIMEZONE: Siempre operar en hora de Chile
date_default_timezone_set('America/Santiago');

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->proyecto_id) && isset($data->horas)) {
    try {
        $query = "INSERT INTO bitacora_horas (proyecto_id, horas, descripcion, fecha_trabajo, fecha_creacion)
                  VALUES (:pid, :horas, :desc, :fecha, :fcreacion)";

        $stmt = $conn->prepare($query);

        $proyecto_id = (int)$data->proyecto_id;
        $horas       = (float)$data->horas;
        $descripcion = !empty($data->descripcion) ? $data->descripcion : 'Trabajo realizado';

        // fecha_trabajo: la que elige el usuario en el calendario (solo fecha, sin hora)
        $fecha = !empty($data->fecha_trabajo) ? $data->fecha_trabajo : date('Y-m-d');

        // fecha_creacion: ahora exacto en Santiago (para el log de auditoría)
        $fecha_creacion = date('Y-m-d H:i:s');

        $stmt->execute([
            ":pid"        => $proyecto_id,
            ":horas"      => $horas,
            ":desc"       => $descripcion,
            ":fecha"      => $fecha,
            ":fcreacion"  => $fecha_creacion,
        ]);

        echo json_encode([
            "status"  => "success",
            "message" => "Horas registradas correctamente",
            "id"      => (int)$conn->lastInsertId(),
            "fecha_creacion" => date('Y-m-d\TH:i:sP'), // ISO con offset para el frontend
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Error de DB: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode([
        "status"  => "error",
        "message" => "Datos incompletos. Se requiere proyecto_id y horas.",
    ]);
}