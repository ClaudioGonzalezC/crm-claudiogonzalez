<?php
include_once '../config/config.php';

try {
    $query = "SELECT * FROM configuracion_perfil WHERE id = 1";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $config = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$config) {
        // Valores por defecto para que el sistema no explote
        $config = [
            "sueldo_liquido_meta" => 2500000,
            "gastos_fijos" => 146000,
            "seguridad_social" => 80000,
            "retencion_impuesto" => 15.25,
            "horas_mensuales_disponibles" => 66,
            "valor_hora_meta" => 48735
        ];
    }
    echo json_encode($config);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>