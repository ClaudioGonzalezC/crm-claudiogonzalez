<?php
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");
header('Content-Type: application/json');

include_once '../config/config.php';

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
    $query = "SELECT
                p.id,
                p.nombre_proyecto                        AS proyecto,
                c.nombre_empresa                         AS cliente_nombre,
                p.estado,
                p.share_token,
                p.monto_bruto,
                p.retencion_sii,
                (p.monto_bruto - p.retencion_sii)       AS monto_liquido,
                p.fecha_aceptacion,
                -- Activos digitales (dominios y hosting)
                p.dominio_nombre,
                p.dominio_provider,
                p.dominio_vencimiento,
                p.hosting_provider,
                p.hosting_plan,
                p.hosting_vencimiento,
                -- Financiero
                COALESCE(
                    (SELECT SUM(monto) FROM pagos_proyectos WHERE proyecto_id = p.id),
                0) AS total_pagado,
                COALESCE(
                    (SELECT SUM(monto_bruto) FROM costos_extra WHERE proyecto_id = p.id),
                0) AS total_extras_brutos,
                COALESCE(
                    (SELECT SUM(monto_bruto) FROM costos_extra WHERE proyecto_id = p.id AND visible_cliente = 1),
                0) AS extras_visibles_brutos
              FROM proyectos p
              LEFT JOIN clientes c ON p.cliente_id = c.id
              ORDER BY p.id DESC";

    $stmt = $conn->prepare($query);
    $stmt->execute();
    $proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($proyectos as &$p) {
        $honorarios      = (int) round((float)($p['monto_bruto']            ?? 0));
        $total_extras    = (int) round((float)($p['total_extras_brutos']    ?? 0));
        $extras_visibles = (int) round((float)($p['extras_visibles_brutos'] ?? 0));
        $total_pagado    = (int) round((float)($p['total_pagado']            ?? 0));
        $retencion       = (int) round((float)($p['retencion_sii']          ?? 0));

        $p['id']                     = (int)$p['id'];
        $p['monto_bruto']            = $honorarios;
        $p['retencion_sii']          = $retencion;
        $p['monto_liquido']          = $honorarios - $retencion;
        $p['total_pagado']           = $total_pagado;
        $p['total_extras_brutos']    = $total_extras;
        $p['extras_visibles_brutos'] = $extras_visibles;
        $p['monto_total_contrato']   = calcTotalContrato((float)$honorarios, (float)$total_extras);
        $p['saldo_pendiente']        = max(0, $p['monto_total_contrato'] - $total_pagado);
        $p['estado']                 = (string)($p['estado']      ?? 'Cotización');
        $p['share_token']            = (string)($p['share_token'] ?? '');
        $p['fecha_aceptacion']       = $p['fecha_aceptacion'] ?? null;

        // Activos — null si vacío (frontend lo trata como no configurado)
        $p['dominio_nombre']      = $p['dominio_nombre']      ?: null;
        $p['dominio_provider']    = $p['dominio_provider']    ?: null;
        $p['dominio_vencimiento'] = $p['dominio_vencimiento'] ?: null;
        $p['hosting_provider']    = $p['hosting_provider']    ?: null;
        $p['hosting_plan']        = $p['hosting_plan']        ?: null;
        $p['hosting_vencimiento'] = $p['hosting_vencimiento'] ?: null;
    }
    unset($p);

    echo json_encode($proyectos, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error en servidor: " . $e->getMessage()]);
}
?>