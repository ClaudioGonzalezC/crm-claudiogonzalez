<?php
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");
header('Content-Type: application/json');

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
        function calcUtilidadReal(float $pagos_brutos, float $gastos_visibles): int {
            $base_boleta    = max(0.0, $pagos_brutos - $gastos_visibles);
            $liquido_boleta = round($base_boleta * SII_LIQUID_FACTOR);
            return (int) round($liquido_boleta + $gastos_visibles);
        }
    }
}

$mes  = isset($_GET['mes'])  ? (int)$_GET['mes']  : (int)date('m');
$anio = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');

try {
    // 1. Meta mensual
    $stmtConfig = $conn->prepare("SELECT sueldo_liquido_meta FROM configuracion_perfil WHERE id = 1");
    $stmtConfig->execute();
    $config = $stmtConfig->fetch(PDO::FETCH_ASSOC);
    $meta = (float)($config['sueldo_liquido_meta'] ?? 2500000);

    // 2. Gastos extra del mes separados por visibilidad
    $stGasto = $conn->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN visible_cliente = 1 THEN monto_bruto ELSE 0 END), 0) AS visibles_brutos,
            COALESCE(SUM(CASE WHEN visible_cliente = 0 THEN monto_bruto ELSE 0 END), 0) AS ocultos_brutos
         FROM costos_extra
         WHERE MONTH(fecha_registro) = :mes AND YEAR(fecha_registro) = :anio"
    );
    $stGasto->execute([':mes' => $mes, ':anio' => $anio]);
    $rowGastos = $stGasto->fetch(PDO::FETCH_ASSOC);
    $gastos_visibles_brutos = (float)($rowGastos['visibles_brutos'] ?? 0);

    // 3. Total cobrado en el mes
    $stmtPagos = $conn->prepare(
        "SELECT COALESCE(SUM(monto), 0) AS total_bruto
         FROM pagos_proyectos
         WHERE MONTH(fecha_pago) = :mes AND YEAR(fecha_pago) = :anio"
    );
    $stmtPagos->execute([':mes' => $mes, ':anio' => $anio]);
    $ganado_bruto = (int) round((float)($stmtPagos->fetch(PDO::FETCH_ASSOC)['total_bruto'] ?? 0));

    // 4. Utilidad real (REGLA 4)
    $ganado_liquido = calcUtilidadReal((float)$ganado_bruto, $gastos_visibles_brutos);

    // 5. Pendiente en proyectos activos (REGLA 5)
    $stmtActivos = $conn->prepare(
        "SELECT
            p.id,
            p.monto_bruto,
            COALESCE((SELECT SUM(monto_bruto) FROM costos_extra WHERE proyecto_id = p.id), 0) AS total_extras
         FROM proyectos p
         WHERE p.estado IN ('En Desarrollo', 'Desarrollo Inicial', 'Revisiones')
            OR p.estado REGEXP '^Revisión [0-9]+'"
    );
    $stmtActivos->execute();
    $proyectosActivos = $stmtActivos->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $pendiente_total_bruto = 0;
    foreach ($proyectosActivos as $pAct) {
        $total_contrato = calcTotalContrato((float)$pAct['monto_bruto'], (float)$pAct['total_extras']);
        $stPagado = $conn->prepare("SELECT COALESCE(SUM(monto), 0) AS pagado FROM pagos_proyectos WHERE proyecto_id = :pid");
        $stPagado->execute([':pid' => (int)$pAct['id']]);
        $pagado_parcial = (float)($stPagado->fetch(PDO::FETCH_ASSOC)['pagado'] ?? 0);
        $pendiente_total_bruto += max(0, $total_contrato - $pagado_parcial);
    }

    // 6. Pipeline: cotizaciones
    $stmtCotizado = $conn->prepare(
        "SELECT COALESCE(
            SUM(p.monto_bruto + COALESCE(
                (SELECT SUM(monto_bruto) FROM costos_extra WHERE proyecto_id = p.id),
            0))
         , 0) AS total
         FROM proyectos p WHERE p.estado = 'Cotización'"
    );
    $stmtCotizado->execute();
    $cotizado_bruto = (float)($stmtCotizado->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

    // 7. Proyectos recientes con datos para badge 48h
    $stmtGrid = $conn->prepare(
        "SELECT
            p.id,
            p.nombre_proyecto,
            p.estado,
            p.monto_bruto,
            (p.monto_bruto - p.retencion_sii)                                                    AS monto_liquido,
            p.fecha_aceptacion,
            COALESCE((SELECT SUM(monto_bruto) FROM costos_extra WHERE proyecto_id = p.id), 0)    AS total_extras,
            COALESCE((SELECT SUM(monto)       FROM pagos_proyectos  WHERE proyecto_id = p.id), 0) AS total_pagado
         FROM proyectos p
         WHERE MONTH(p.fecha_creacion) = :mes AND YEAR(p.fecha_creacion) = :anio
         ORDER BY p.fecha_creacion DESC LIMIT 4"
    );
    $stmtGrid->execute([':mes' => $mes, ':anio' => $anio]);
    $proyectosRecientesRaw = $stmtGrid->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $proyectosRecientes = [];
    foreach ($proyectosRecientesRaw as $pr) {
        $pr['monto_total_real'] = calcTotalContrato((float)$pr['monto_bruto'], (float)$pr['total_extras']);
        $pr['monto_bruto']      = (int) round((float)$pr['monto_bruto']);
        $pr['monto_liquido']    = (int) round((float)$pr['monto_liquido']);
        $pr['total_pagado']     = (int) round((float)$pr['total_pagado']);
        $pr['total_extras']     = (int) round((float)$pr['total_extras']);
        $proyectosRecientes[]   = $pr;
    }

    // 8. Meta
    $porcentaje       = ($meta > 0) ? ($ganado_liquido / $meta) * 100 : 0;
    $restante_liquido = max(0, $meta - $ganado_liquido);

    echo json_encode([
        "status"                 => "success",
        "mes_consultado"         => $mes,
        "anio_consultado"        => $anio,
        "meta_liquida_mensual"   => $meta,
        "total_ganado"           => $ganado_bruto,
        "ganado_liquido"         => $ganado_liquido,
        "gastos_visibles_brutos" => (int) round($gastos_visibles_brutos),
        "total_pendiente"        => (int) round($pendiente_total_bruto),
        "total_cotizado"         => (int) round($cotizado_bruto),
        "porcentaje_meta"        => round($porcentaje, 2),
        "restante_para_meta"     => (int) round($restante_liquido),
        "proyectos_recientes"    => $proyectosRecientes,
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}