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

        // ─────────────────────────────────────────────────────────────
        // V2 — CASTING DE CAMPOS ESCALARES
        // p.* ya los trae — solo normalizamos tipos para el frontend
        // ─────────────────────────────────────────────────────────────
        $proyecto['status_v2']                = $proyecto['status_v2'] ?? null;
        $proyecto['has_project_eval']         = (bool)(int)($proyecto['has_project_eval']         ?? 0);
        $proyecto['emotional_eval_completed'] = (bool)(int)($proyecto['emotional_eval_completed'] ?? 0);
        $proyecto['profit_calculated']        = (bool)(int)($proyecto['profit_calculated']        ?? 0);
        $proyecto['cost_hour']                = isset($proyecto['cost_hour'])         && $proyecto['cost_hour']         !== null ? (float)$proyecto['cost_hour']         : null;
        $proyecto['overhead_snapshot']        = isset($proyecto['overhead_snapshot']) && $proyecto['overhead_snapshot'] !== null ? (float)$proyecto['overhead_snapshot']  : null;
        $proyecto['real_hours']               = (float)($proyecto['real_hours'] ?? 0);
        $proyecto['eval_score']               = isset($proyecto['eval_score'])   && $proyecto['eval_score']   !== null ? (int)  $proyecto['eval_score']   : null;
        $proyecto['net_profit']               = isset($proyecto['net_profit'])   && $proyecto['net_profit']   !== null ? (float)$proyecto['net_profit']   : null;
        $proyecto['stress_score']             = isset($proyecto['stress_score']) && $proyecto['stress_score'] !== null ? (float)$proyecto['stress_score'] : null;

        // ─────────────────────────────────────────────────────────────
        // V2 — SECCIÓN 1: workflow
        // Lightweight: status_v2, is_closed, flags. Sin valid_transitions.
        // ─────────────────────────────────────────────────────────────
        $proyecto['workflow'] = [
            'status_v2' => $proyecto['status_v2'],
            'is_closed' => $proyecto['status_v2'] === 'Closed',
            'flags'     => [
                'has_project_eval'         => $proyecto['has_project_eval'],
                'emotional_eval_completed' => $proyecto['emotional_eval_completed'],
                'profit_calculated'        => $proyecto['profit_calculated'],
            ],
        ];

        // ─────────────────────────────────────────────────────────────
        // V2 — SECCIÓN 2: quote (versión más reciente + items)
        // ─────────────────────────────────────────────────────────────
        $stmtQ = $conn->prepare("
            SELECT id, version_num, subtotal, buffer_pct,
                   projected_bruto, projected_liquido,
                   approved, approved_date, created_at
            FROM   quotes
            WHERE  project_id = :pid
            ORDER  BY version_num DESC
            LIMIT  1
        ");
        $stmtQ->execute([':pid' => $id]);
        $quote = $stmtQ->fetch(PDO::FETCH_ASSOC) ?: null;

        if ($quote) {
            $quote['id']                = (int)   $quote['id'];
            $quote['version_num']       = (int)   $quote['version_num'];
            $quote['subtotal']          = $quote['subtotal']          !== null ? (float) $quote['subtotal']          : null;
            $quote['buffer_pct']        = $quote['buffer_pct']        !== null ? (float) $quote['buffer_pct']        : null;
            $quote['projected_bruto']   = $quote['projected_bruto']   !== null ? (float) $quote['projected_bruto']   : null;
            $quote['projected_liquido'] = $quote['projected_liquido'] !== null ? (float) $quote['projected_liquido'] : null;
            $quote['approved']          = (bool)  $quote['approved'];

            $stmtQI = $conn->prepare("
                SELECT id, task_name, est_hours, hourly_rate, line_total
                FROM   quote_items
                WHERE  quote_id = :qid
                ORDER  BY id ASC
            ");
            $stmtQI->execute([':qid' => $quote['id']]);
            $qitems = $stmtQI->fetchAll(PDO::FETCH_ASSOC);
            foreach ($qitems as &$qi) {
                $qi['id']          = (int)   $qi['id'];
                $qi['est_hours']   = (float) $qi['est_hours'];
                $qi['hourly_rate'] = (float) $qi['hourly_rate'];
                $qi['line_total']  = (float) $qi['line_total'];
            }
            unset($qi);
            $quote['items'] = $qitems;
        }
        $proyecto['quote'] = $quote;

        // ─────────────────────────────────────────────────────────────
        // V2 — SECCIÓN 3: boletas_v2
        // Dos queries separadas: list + totals (no se mezcla SUM con list)
        // ─────────────────────────────────────────────────────────────

        // 3a. list
        $stmtBL = $conn->prepare("
            SELECT id, numero_boleta, status, fecha_emision,
                   monto_bruto, retencion_pct, monto_retencion, monto_liquido,
                   tipo_cobro, paid_date, payment_method, f29_paid, created_at
            FROM   boletas
            WHERE  project_id = :pid
            ORDER  BY fecha_emision ASC, id ASC
        ");
        $stmtBL->execute([':pid' => $id]);
        $boletas_list = $stmtBL->fetchAll(PDO::FETCH_ASSOC);
        foreach ($boletas_list as &$bl) {
            $bl['id']              = (int)   $bl['id'];
            $bl['monto_bruto']     = (float) $bl['monto_bruto'];
            $bl['retencion_pct']   = (float) $bl['retencion_pct'];
            $bl['monto_retencion'] = (float) $bl['monto_retencion'];
            $bl['monto_liquido']   = (float) $bl['monto_liquido'];
            $bl['f29_paid']        = (bool)  $bl['f29_paid'];
        }
        unset($bl);

        // 3b. totals (query separada)
        $stmtBT = $conn->prepare("
            SELECT
                COUNT(*)                                                                          AS count,
                COALESCE(SUM(monto_bruto), 0)                                                     AS total_bruto,
                COALESCE(SUM(monto_retencion), 0)                                                 AS total_retencion,
                COALESCE(SUM(monto_liquido), 0)                                                   AS total_liquido,
                COALESCE(SUM(CASE WHEN paid_date IS NOT NULL THEN monto_liquido ELSE 0 END), 0)   AS liquido_cobrado,
                COALESCE(SUM(CASE WHEN f29_paid = 0 AND paid_date IS NOT NULL THEN 1 ELSE 0 END), 0) AS f29_pendientes
            FROM boletas
            WHERE project_id = :pid
        ");
        $stmtBT->execute([':pid' => $id]);
        $bt = $stmtBT->fetch(PDO::FETCH_ASSOC);

        $proyecto['boletas_v2'] = [
            'count'  => (int) $bt['count'],
            'totals' => [
                'total_bruto'     => (float) $bt['total_bruto'],
                'total_retencion' => (float) $bt['total_retencion'],
                'total_liquido'   => (float) $bt['total_liquido'],
                'liquido_cobrado' => (float) $bt['liquido_cobrado'],
                'f29_pendientes'  => (int)   $bt['f29_pendientes'],
            ],
            'list' => $boletas_list,
        ];

        // ─────────────────────────────────────────────────────────────
        // V2 — SECCIÓN 4: expenses_v2
        // ─────────────────────────────────────────────────────────────
        $stmtEX = $conn->prepare("
            SELECT id, expense_name, amount, expense_date, category, notes, created_at
            FROM   project_expenses
            WHERE  project_id = :pid
            ORDER  BY expense_date ASC, id ASC
        ");
        $stmtEX->execute([':pid' => $id]);
        $expenses_list  = $stmtEX->fetchAll(PDO::FETCH_ASSOC);
        $total_expenses = 0.0;
        foreach ($expenses_list as &$ex2) {
            $ex2['id']     = (int)   $ex2['id'];
            $ex2['amount'] = (float) $ex2['amount'];
            $total_expenses += $ex2['amount'];
        }
        unset($ex2);

        $proyecto['expenses_v2'] = [
            'count'          => count($expenses_list),
            'total_expenses' => round($total_expenses, 2),
            'list'           => $expenses_list,
        ];

        // ─────────────────────────────────────────────────────────────
        // V2 — SECCIÓN 5: project_eval
        // null si no existe; answers es array vacío si eval existe sin respuestas
        // ─────────────────────────────────────────────────────────────
        $stmtPE = $conn->prepare("
            SELECT id, score, notes, created_at
            FROM   project_evals
            WHERE  project_id = :pid
            LIMIT  1
        ");
        $stmtPE->execute([':pid' => $id]);
        $project_eval = $stmtPE->fetch(PDO::FETCH_ASSOC) ?: null;

        if ($project_eval) {
            $project_eval['id']    = (int) $project_eval['id'];
            $project_eval['score'] = (int) $project_eval['score'];

            $stmtAns = $conn->prepare("
                SELECT a.question_id, q.question, q.type,
                       a.answer_value, a.answer_notes
                FROM   answers a
                INNER JOIN questions q ON q.id = a.question_id
                WHERE  a.project_id = :pid
                  AND  q.module     = 'project_eval'
                ORDER  BY q.order_num ASC, q.id ASC
            ");
            $stmtAns->execute([':pid' => $id]);
            $answers = $stmtAns->fetchAll(PDO::FETCH_ASSOC);
            foreach ($answers as &$ans) {
                $ans['question_id'] = (int) $ans['question_id'];
            }
            unset($ans);
            $project_eval['answers'] = $answers; // [] si no hay respuestas aún
        }
        $proyecto['project_eval'] = $project_eval;

        // ─────────────────────────────────────────────────────────────
        // V2 — SECCIÓN 6: emotional_eval
        // null si no existe
        // ─────────────────────────────────────────────────────────────
        $stmtEE = $conn->prepare("
            SELECT satisfaction_score, stress_level, client_conflicts,
                   would_repeat, learning_outcome, final_notes, created_at
            FROM   emotional_evals
            WHERE  project_id = :pid
            LIMIT  1
        ");
        $stmtEE->execute([':pid' => $id]);
        $emotional_eval = $stmtEE->fetch(PDO::FETCH_ASSOC) ?: null;

        if ($emotional_eval) {
            $emotional_eval['satisfaction_score'] = $emotional_eval['satisfaction_score'] !== null ? (float) $emotional_eval['satisfaction_score'] : null;
            $emotional_eval['stress_level']       = $emotional_eval['stress_level']       !== null ? (float) $emotional_eval['stress_level']       : null;
            $emotional_eval['client_conflicts']   = (bool) $emotional_eval['client_conflicts'];
            $emotional_eval['would_repeat']       = (bool) $emotional_eval['would_repeat'];
        }
        $proyecto['emotional_eval'] = $emotional_eval;

        // ─────────────────────────────────────────────────────────────
        // V2 — SECCIÓN 7: time_summary
        // Agregado de bitacora_horas por tipo (ENUM oficial: crm_spec.md)
        // ─────────────────────────────────────────────────────────────
        $stmtTS = $conn->prepare("
            SELECT   type, SUM(horas) AS total_horas
            FROM     bitacora_horas
            WHERE    proyecto_id = :pid
            GROUP BY type
        ");
        $stmtTS->execute([':pid' => $id]);
        $time_rows = $stmtTS->fetchAll(PDO::FETCH_ASSOC);

        $by_type = [
            'billable_dev'     => 0.0,
            'meeting'          => 0.0,
            'non_billable_fix' => 0.0,
            'admin'            => 0.0,
        ];
        $total_hours_v2 = 0.0;
        foreach ($time_rows as $tr) {
            $t = $tr['type'];
            $h = (float) $tr['total_horas'];
            if (array_key_exists($t, $by_type)) {
                $by_type[$t] = $h;
            }
            $total_hours_v2 += $h;
        }

        $proyecto['time_summary'] = [
            'total_hours' => round($total_hours_v2, 2),
            'by_type'     => $by_type,
        ];

        // ─────────────────────────────────────────────────────────────
        // FIN V2 — retornar respuesta completa
        // ─────────────────────────────────────────────────────────────
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