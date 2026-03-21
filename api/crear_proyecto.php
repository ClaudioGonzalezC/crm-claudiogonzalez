<?php
include_once '../config/config.php';
header('Content-Type: application/json');

date_default_timezone_set('America/Santiago');

// Fallback inline si financial_rules.php aún no está en el servidor
if (file_exists('../config/financial_rules.php')) {
    include_once '../config/financial_rules.php';
} else {
    if (!defined('SII_LIQUID_FACTOR')) {
        define('SII_LIQUID_FACTOR', 0.8475);
    }
}

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->nombre_proyecto) && !empty($data->cliente_id)) {
    try {
        $conn->beginTransaction();

        // ── Financiero ──────────────────────────────────────────────────────────
        $horas           = floatval($data->horas_estimadas    ?? 0);
        $valor_bruto_hora = floatval($data->valor_hora_acordado ?? 0);
        $monto_bruto     = round($horas * $valor_bruto_hora, 2);
        $retencion_sii   = round($monto_bruto * 0.1525, 2);
        $share_token     = bin2hex(random_bytes(12));

        // ── Activos Digitales — sanitizar fechas ────────────────────────────────
        // Las fechas llegan como "YYYY-MM-DD" desde el input[type=date] de React.
        // NULL si vacío para que MySQL las guarde como NULL (columna DATE).
        $dominio_nombre      = !empty($data->dominio_nombre)      ? trim($data->dominio_nombre)      : null;
        $dominio_provider    = !empty($data->dominio_provider)    ? trim($data->dominio_provider)    : null;
        $dominio_vencimiento = !empty($data->dominio_vencimiento) ? trim($data->dominio_vencimiento) : null;
        $hosting_provider    = !empty($data->hosting_provider)    ? trim($data->hosting_provider)    : null;
        $hosting_plan        = !empty($data->hosting_plan)        ? trim($data->hosting_plan)        : null;
        $hosting_vencimiento = !empty($data->hosting_vencimiento) ? trim($data->hosting_vencimiento) : null;

        // Validar formato YYYY-MM-DD (evita que MySQL rechace fechas malformadas)
        $datePattern = '/^\d{4}-\d{2}-\d{2}$/';
        if ($dominio_vencimiento && !preg_match($datePattern, $dominio_vencimiento)) {
            $dominio_vencimiento = null;
        }
        if ($hosting_vencimiento && !preg_match($datePattern, $hosting_vencimiento)) {
            $hosting_vencimiento = null;
        }

        // ── INSERT con los 6 campos de activos ──────────────────────────────────
        $fecha_creacion = date('Y-m-d H:i:s'); // America/Santiago ya activo

        $query = "INSERT INTO proyectos (
                    cliente_id, nombre_proyecto, estado, horas_estimadas,
                    valor_hora_acordado, monto_bruto, retencion_sii,
                    revisiones_totales, share_token, terminos_condiciones,
                    dominio_nombre, dominio_provider, dominio_vencimiento,
                    hosting_provider, hosting_plan, hosting_vencimiento,
                    fecha_creacion
                  ) VALUES (
                    :ci, :np, :es, :he, :vh, :mb, :rs, :rt, :st, :tc,
                    :dn, :dp, :dv, :hp, :hpl, :hv,
                    :fc
                  )";

        $stmt = $conn->prepare($query);
        $stmt->execute([
            ":ci"  => (int)$data->cliente_id,
            ":np"  => $data->nombre_proyecto,
            ":es"  => $data->estado ?? 'Cotización',
            ":he"  => $horas,
            ":vh"  => $valor_bruto_hora,
            ":mb"  => $monto_bruto,
            ":rs"  => $retencion_sii,
            ":rt"  => (int)($data->revisiones_totales ?? $data->revisiones_incluidas ?? 0),
            ":st"  => $share_token,
            ":tc"  => $data->terminos_condiciones ?? null,
            // Activos
            ":dn"  => $dominio_nombre,
            ":dp"  => $dominio_provider,
            ":dv"  => $dominio_vencimiento,
            ":hp"  => $hosting_provider,
            ":hpl" => $hosting_plan,
            ":hv"  => $hosting_vencimiento,
            ":fc"  => $fecha_creacion,
        ]);

        $proyecto_id = $conn->lastInsertId();

        // ── Costos Extra ────────────────────────────────────────────────────────
        if (!empty($data->costos_extra) && is_array($data->costos_extra)) {
            $queryGasto = "INSERT INTO costos_extra
                            (proyecto_id, descripcion, monto_liquido, monto_bruto, visible_cliente)
                           VALUES (:pid, :desc, :liq, :bru, :vis)";
            $stmtG = $conn->prepare($queryGasto);

            foreach ($data->costos_extra as $gasto) {
                $liq     = floatval($gasto->monto_liquido ?? 0);
                $bru     = floatval($gasto->monto_bruto   ?? 0);
                $visible = 1;
                if (isset($gasto->visible_cliente)) {
                    $visible = ($gasto->visible_cliente === true || $gasto->visible_cliente == 1) ? 1 : 0;
                }
                if ($bru > 0) {
                    $stmtG->execute([
                        ':pid'  => $proyecto_id,
                        ':desc' => $gasto->descripcion,
                        ':liq'  => $liq,
                        ':bru'  => $bru,
                        ':vis'  => $visible,
                    ]);
                }
            }
        }

        $conn->commit();

        echo json_encode([
            "status"  => "success",
            "id"      => $proyecto_id,
            "message" => "Proyecto y activos creados con éxito.",
        ]);

    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Faltan campos obligatorios"]);
}
?>