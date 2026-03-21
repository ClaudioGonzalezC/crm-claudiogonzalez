<?php
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");
header('Content-Type: application/json');

include_once '../config/config.php';

$id = isset($_GET['id']) ? $_GET['id'] : null;

if (!$id) {
    http_response_code(400);
    echo json_encode(["error" => "ID de proyecto no proporcionado"]);
    exit;
}

try {
    // 1. Consulta Principal
    $query = "SELECT 
                p.*, 
                c.nombre_empresa as cliente_nombre,
                c.email as cliente_email,
                p.monto_bruto,
                p.retencion_sii,
                p.revisiones_totales as revisiones_incluidas,
                p.share_token,
                p.dominio_nombre,
                p.dominio_provider,
                p.dominio_vencimiento,
                p.hosting_provider,
                p.hosting_plan,
                p.hosting_vencimiento,
                p.terminos_condiciones,
                p.terminos_aceptados,
                p.fecha_aceptacion,
                p.mostrar_seguimiento_tiempo
              FROM proyectos p 
              LEFT JOIN clientes c ON p.cliente_id = c.id 
              WHERE p.id = :id";
              
    $stmt = $conn->prepare($query);
    $stmt->execute([':id' => $id]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($proyecto) {
        // --- HONORARIOS ---
        $honor_bruto = round((float)$proyecto['monto_bruto']);
        $proyecto['monto_bruto'] = $honor_bruto;
        $retencion_redondeada = round((float)$proyecto['retencion_sii']);
        $proyecto['monto_liquido'] = $honor_bruto - $retencion_redondeada;

        // --- COSTOS EXTRA ---
        $qExtras = "SELECT id, descripcion, monto_liquido, monto_bruto, visible_cliente, fecha_registro
                    FROM costos_extra 
                    WHERE proyecto_id = :pid 
                    ORDER BY id DESC";
        $stExtras = $conn->prepare($qExtras);
        $stExtras->execute([':pid' => $id]);
        $extras = $stExtras->fetchAll(PDO::FETCH_ASSOC);

        // Acumuladores
        $neto_ocultos              = 0;  // ocultos → gross-up round → van en boleta
        $neto_visibles             = 0;  // visibles → reembolso 1:1 → se suman DESPUÉS de retención
        $total_gastos_brutos_admin    = 0;
        $total_gastos_brutos_visibles = 0;
        $total_gastos_liquidos        = 0;

        foreach ($extras as &$ex) {
            $ex['id']             = (int)$ex['id'];
            $ex['monto_liquido']  = round((float)$ex['monto_liquido']);
            $ex['monto_bruto']    = round((float)$ex['monto_bruto']);
            $ex['visible_cliente']= (int)$ex['visible_cliente'];

            $total_gastos_brutos_admin += $ex['monto_bruto'];
            $total_gastos_liquidos     += $ex['monto_liquido'];

            if ($ex['visible_cliente'] === 1) {
                $total_gastos_brutos_visibles += $ex['monto_bruto'];
                $neto_visibles += $ex['monto_liquido'];
            } else {
                $neto_ocultos += $ex['monto_liquido'];
            }
        }

        $proyecto['costos_extra']                 = $extras;
        $proyecto['total_gastos_brutos']          = $total_gastos_brutos_admin;
        $proyecto['total_gastos_brutos_visibles']  = $total_gastos_brutos_visibles;
        $proyecto['total_gastos_liquidos']         = $total_gastos_liquidos;

        // --- BASE BOLETA ---
        // REGLA DEFINITIVA:
        //   Ocultos  → round(neto / 0.8475) → internalizado como honorario → va en boleta
        //   Visibles → reembolso 1:1         → se suma AL LÍQUIDO, DESPUÉS de retención
        //
        // Ejemplo: $1M honor + $10k luz (oculto) + $10k dominio (visible)
        //   bruto_ocultos  = round(10000/0.8475) = 11.799
        //   base_boleta    = 1.000.000 + 11.799  = 1.011.799
        //   retencion      = round(1.011.799 × 0.1525) = 154.299
        //   liquido_boleta = 1.011.799 − 154.299       = 857.500
        //   + dominio 1:1 (reembolso)                  =  10.000
        //   total_liquido  = 857.500 + 10.000          = 867.500
        //   abono_50       = round(867.500 × 0.5)      = 433.750
        $LIQUID = 0.8475;
        $bruto_ocultos    = $neto_ocultos > 0 ? (int) round($neto_ocultos / $LIQUID) : 0;
        $base_boleta      = $honor_bruto + $bruto_ocultos;
        $retencion_boleta = (int) round($base_boleta * 0.1525);
        $liquido_boleta   = $base_boleta - $retencion_boleta;
        $total_liquido    = $liquido_boleta + $neto_visibles;  // reembolsos se suman al final
        $abono_50         = (int) round($total_liquido * 0.5);

        // Campos nuevos para el frontend
        $proyecto['base_boleta']    = $base_boleta;    // lo que se boletea
        $proyecto['liquido_boleta'] = $liquido_boleta; // líquido honorarios puros
        $proyecto['total_liquido']  = $total_liquido;  // líquido total (honor + reembolsos)
        $proyecto['abono_50']       = $abono_50;

        // TOTAL CONTRATO (admin) = honorarios + TODOS los costos BD reales (para saldo pendiente)
        $proyecto['monto_total_contrato']         = $honor_bruto + $total_gastos_brutos_admin;
        // TOTAL CONTRATO (cliente) = honorarios + costos visibles BD
        $proyecto['monto_total_contrato_cliente'] = $honor_bruto + $total_gastos_brutos_visibles;

        // TOTAL PAGADO y SALDO PENDIENTE (sobre total admin)
        $qPagado = "SELECT COALESCE(SUM(monto), 0) as total FROM pagos_proyectos WHERE proyecto_id = :pid";
        $stPagado = $conn->prepare($qPagado);
        $stPagado->execute([':pid' => $id]);
        $proyecto['total_pagado'] = round((float)$stPagado->fetch(PDO::FETCH_ASSOC)['total']);
        $proyecto['saldo_pendiente'] = max(0, $proyecto['monto_total_contrato'] - $proyecto['total_pagado']);

        // --- CONVERSIÓN DE TIPOS PARA REACT ---
        $proyecto['id']                   = (int)$proyecto['id'];
        $proyecto['horas_estimadas']       = (float)$proyecto['horas_estimadas'];
        $proyecto['valor_hora_acordado']   = (float)$proyecto['valor_hora_acordado'];
        $proyecto['revisiones_incluidas']  = (int)($proyecto['revisiones_incluidas'] ?? 0);
        $proyecto['revisiones_usadas']     = (int)($proyecto['revisiones_usadas'] ?? 0);
        
        // Campos de acuerdo
        $proyecto['terminos_condiciones']  = $proyecto['terminos_condiciones'] ?: "";
        $proyecto['terminos_aceptados']    = (int)($proyecto['terminos_aceptados'] ?? 0);
        // Control de visibilidad — fallback true si la columna aún no existe
        $proyecto['mostrar_seguimiento_tiempo'] = isset($proyecto['mostrar_seguimiento_tiempo'])
            ? (bool)(int)$proyecto['mostrar_seguimiento_tiempo']
            : true;
        
        echo json_encode($proyecto);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Proyecto no encontrado"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>