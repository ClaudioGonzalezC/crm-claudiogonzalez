<?php
include_once '../config/config.php';
$data = json_decode(file_get_contents("php://input"));

try {
    $query = "REPLACE INTO configuracion_perfil 
              SET id=1, sueldo_liquido_meta=:sl, gastos_fijos=:gf, 
                  seguridad_social=:ss, retencion_impuesto=:ri, 
                  horas_mensuales_disponibles=:h, valor_hora_meta=:vh";

    $stmt = $conn->prepare($query);
    $stmt->execute([
        ":sl" => $data->sueldo_liquido_meta,
        ":gf" => $data->gastos_fijos,
        ":ss" => $data->seguridad_social,
        ":ri" => $data->retencion_impuesto,
        ":h" => $data->horas_mensuales_disponibles,
        ":vh" => $data->valor_hora_meta
    ]);

    echo json_encode(["message" => "Configuración actualizada"]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>