<?php
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");
header('Content-Type: application/json');

include_once '../config/config.php';

$token = isset($_GET['token']) ? $_GET['token'] : '';

if (!empty($token)) {
    try {
        // 1. Consulta principal
        $query = "SELECT p.id, p.nombre_proyecto, p.estado, p.horas_estimadas, 
                        p.valor_hora_acordado,
                        p.revisiones_totales as revisiones_incluidas, 
                        p.revisiones_usadas, 
                        c.nombre_empresa as cliente_nombre,
                        p.monto_bruto,
                        p.retencion_sii,
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
                INNER JOIN clientes c ON p.cliente_id = c.id
                WHERE p.share_token = :token LIMIT 1";
                
        $stmt = $conn->prepare($query);
        $stmt->execute([':token' => $token]);
        $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($proyecto) {
            $pid = $proyecto['id'];
            
            // --- HONORARIOS ---
            $honor_bruto = round((float)$proyecto['monto_bruto']);
            $proyecto['monto_bruto'] = $honor_bruto;
            $retencion_redondeada = round((float)$proyecto['retencion_sii']);
            $proyecto['monto_liquido'] = $honor_bruto - $retencion_redondeada;

            // --- CASTEOS PARA REACT ---
            $proyecto['id']                   = (int)$proyecto['id'];
            $proyecto['revisiones_incluidas'] = (int)$proyecto['revisiones_incluidas'];
            $proyecto['revisiones_totales']   = $proyecto['revisiones_incluidas'];
            $proyecto['revisiones_usadas']    = (int)$proyecto['revisiones_usadas'];
            $proyecto['valor_hora_acordado']  = (float)$proyecto['valor_hora_acordado'];
            $proyecto['horas_estimadas']      = (float)$proyecto['horas_estimadas'];
            $proyecto['terminos_aceptados']   = (int)$proyecto['terminos_aceptados'];
            $proyecto['terminos_condiciones'] = $proyecto['terminos_condiciones'] ?: "";
            $proyecto['mostrar_seguimiento_tiempo'] = isset($proyecto['mostrar_seguimiento_tiempo'])
                ? (bool)(int)$proyecto['mostrar_seguimiento_tiempo']
                : true;

            // 2. Bitácora de Horas
            $qHoras = "SELECT horas, descripcion, fecha_trabajo FROM bitacora_horas WHERE proyecto_id = :pid ORDER BY fecha_trabajo DESC";
            $stHoras = $conn->prepare($qHoras);
            $stHoras->execute([':pid' => $pid]);
            $bitacora = $stHoras->fetchAll(PDO::FETCH_ASSOC);

            // 3. Pagos Recibidos
            $qPagos = "SELECT monto, descripcion, fecha_pago FROM pagos_proyectos WHERE proyecto_id = :pid ORDER BY fecha_pago DESC";
            $stPagos = $conn->prepare($qPagos);
            $stPagos->execute([':pid' => $pid]);
            $pagos = $stPagos->fetchAll(PDO::FETCH_ASSOC);

            foreach ($pagos as &$p) {
                $p['monto'] = round((float)$p['monto']);
                $p['descripcion'] = $p['descripcion'] ?: 'Pago registrado';
            }

            // 4. Costos Extras — todos para cálculo interno, solo visibles para desglose UI
            $qExtrasAll = "SELECT id, descripcion, monto_liquido, monto_bruto, fecha_registro, visible_cliente 
                           FROM costos_extra 
                           WHERE proyecto_id = :pid 
                           ORDER BY id DESC";
            $stExtrasAll = $conn->prepare($qExtrasAll);
            $stExtrasAll->execute([':pid' => $pid]);
            $extras_all = $stExtrasAll->fetchAll(PDO::FETCH_ASSOC);

            // Acumuladores
            $LIQUID = 0.8475;
            $neto_ocultos                 = 0;
            $neto_visibles                = 0;
            $total_gastos_brutos_todos    = 0;
            $total_gastos_brutos_visibles = 0;
            $extras = [];   // Solo visibles para el desglose UI del cliente

            foreach ($extras_all as $e) {
                $ml  = round((float)$e['monto_liquido']);
                $mb  = round((float)$e['monto_bruto']);
                $vis = (int)$e['visible_cliente'];

                $total_gastos_brutos_todos += $mb;

                if ($vis === 1) {
                    $neto_visibles += $ml;
                    $total_gastos_brutos_visibles += $mb;
                    $extras[] = [
                        "id"             => (int)$e['id'],
                        "descripcion"    => $e['descripcion'],
                        "monto"          => $mb,
                        "monto_liquido"  => $ml,
                        "fecha"          => $e['fecha_registro'],
                        "visible_cliente"=> 1,
                    ];
                } else {
                    $neto_ocultos += $ml;
                }
            }

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
            $bruto_ocultos    = $neto_ocultos > 0 ? (int) round($neto_ocultos / $LIQUID) : 0;
            $base_boleta      = $honor_bruto + $bruto_ocultos;
            $retencion_boleta = (int) round($base_boleta * 0.1525);
            $liquido_boleta   = $base_boleta - $retencion_boleta;
            $total_liquido    = $liquido_boleta + $neto_visibles;
            $abono_50         = (int) round($total_liquido * 0.5);

            $proyecto['base_boleta']    = $base_boleta;
            $proyecto['liquido_boleta'] = $liquido_boleta;
            $proyecto['total_liquido']  = $total_liquido;
            $proyecto['abono_50']       = $abono_50;

            // monto_total_contrato = deuda REAL = honorarios + TODOS los costos BD (para saldo pendiente)
            $monto_total_contrato = $honor_bruto + $total_gastos_brutos_todos;
            $total_pagado         = round(array_sum(array_column($pagos, 'monto')));

            $proyecto['total_gastos_brutos']          = $total_gastos_brutos_todos;
            $proyecto['total_gastos_brutos_visibles']  = $total_gastos_brutos_visibles;
            $proyecto['monto_total_contrato']          = $monto_total_contrato;
            $proyecto['total_pagado']                  = $total_pagado;
            $proyecto['saldo_pendiente']               = max(0, $monto_total_contrato - $total_pagado);

            echo json_encode([
                "status"   => "success",
                "proyecto" => $proyecto,
                "bitacora" => $bitacora,
                "pagos"    => $pagos,
                "extras"   => $extras
            ]);
        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Proyecto no encontrado"]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Error de base de datos: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Token requerido"]);
}
?>