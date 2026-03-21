<?php
include_once '../config/config.php';
header('Content-Type: application/json');

date_default_timezone_set('America/Santiago');

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->proyecto_id) && !empty($data->monto)) {
    try {
        $query = "INSERT INTO pagos_proyectos (proyecto_id, monto, descripcion, fecha_pago)
                  VALUES (:pid, :monto, :desc, :fecha)";

        $stmt = $conn->prepare($query);

        // Si el frontend envía fecha_pago (elegida por el usuario), usarla.
        // Si no, usar ahora en hora de Santiago.
        $fecha_final = !empty($data->fecha_pago)
            ? $data->fecha_pago
            : date('Y-m-d H:i:s'); // TZ ya seteada arriba

        $stmt->execute([
            ":pid"   => (int)$data->proyecto_id,
            ":monto" => (float)$data->monto,
            ":desc"  => $data->descripcion ?? 'Abono de proyecto',
            ":fecha" => $fecha_final,
        ]);

        echo json_encode(["status" => "success", "message" => "Pago registrado correctamente"]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Error en la base de datos: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Datos incompletos. Se requiere proyecto_id y monto."]);
}
?>