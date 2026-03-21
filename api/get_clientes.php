<?php
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

include_once '../config/config.php';

// Fallback inline si financial_rules.php aún no está en el servidor
if (file_exists('../config/financial_rules.php')) {
    include_once '../config/financial_rules.php';
} else {
    if (!defined('SII_LIQUID_FACTOR')) {
        define('SII_LIQUID_FACTOR', 0.8475);
        function calcTotalContrato(float $honorarios, float $extras): int {
            return (int) round($honorarios + $extras);
        }
    }
}

try {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    // REGLA 5: inversion_total = SUM(honorarios) + SUM(todos costos_extra.monto_bruto)
    // monto_bruto en costos_extra ya tiene la regla aplicada (visible=1:1, oculto=gross-up)
    $baseSelect = "SELECT
        c.*,
        COALESCE(SUM(p.monto_bruto), 0) AS honorarios_total,
        COALESCE((
            SELECT SUM(ce.monto_bruto)
            FROM costos_extra ce
            INNER JOIN proyectos pp ON ce.proyecto_id = pp.id
            WHERE pp.cliente_id = c.id
        ), 0) AS extras_total";

    if ($id > 0) {
        $query = "$baseSelect
                  FROM clientes c
                  LEFT JOIN proyectos p ON c.id = p.cliente_id
                  WHERE c.id = :id
                  GROUP BY c.id";
        $stmt = $conn->prepare($query);
        $stmt->bindValue(":id", $id, PDO::PARAM_INT);
    } else {
        $query = "$baseSelect
                  FROM clientes c
                  LEFT JOIN proyectos p ON c.id = p.cliente_id
                  GROUP BY c.id
                  ORDER BY c.fecha_creacion DESC";
        $stmt = $conn->prepare($query);
    }

    $stmt->execute();
    $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($clientes as &$cliente) {
        $honorarios = (float)($cliente['honorarios_total'] ?? 0);
        $extras     = (float)($cliente['extras_total']     ?? 0);
        // REGLA 5: total real facturado al cliente
        $cliente['inversion_total'] = (float) calcTotalContrato($honorarios, $extras);
        unset($cliente['honorarios_total'], $cliente['extras_total']);
    }
    unset($cliente);

    echo json_encode($clientes, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>