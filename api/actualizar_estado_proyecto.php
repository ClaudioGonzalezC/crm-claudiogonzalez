<?php
include_once '../config/config.php';
header('Content-Type: application/json');
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

date_default_timezone_set('America/Santiago');

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->id) && !empty($data->estado)) {
    try {
        $proyecto_id = (int)$data->id;
        $nuevo_estado = $data->estado;

        // --- 0. REGLA 1: BLOQUEO GLOBAL DESDE COTIZACIÓN ---
        if ($nuevo_estado !== 'Cotización') {
            $queryEstadoActual = "SELECT estado, monto_bruto,
                                    (SELECT COALESCE(SUM(monto), 0) FROM pagos_proyectos WHERE proyecto_id = p.id) as total_pagado
                                  FROM proyectos p WHERE id = :id";
            $stmtEA = $conn->prepare($queryEstadoActual);
            $stmtEA->execute([':id' => $proyecto_id]);
            $estadoActual = $stmtEA->fetch(PDO::FETCH_ASSOC);

            if ($estadoActual && $estadoActual['estado'] === 'Cotización') {
                $monto_bruto_cot = (float)$estadoActual['monto_bruto'];
                $total_pagado_cot = (float)$estadoActual['total_pagado'];
                $minimo_50_cot = $monto_bruto_cot * 0.5;

                if ($total_pagado_cot < $minimo_50_cot) {
                    http_response_code(403);
                    echo json_encode([
                        "status" => "error",
                        "message" => "Bloqueo: El proyecto requiere un anticipo del 50% para iniciar. Falta registrar $" . number_format($minimo_50_cot - $total_pagado_cot, 0, ',', '.')
                    ]);
                    exit;
                }
            }
        }

        // --- 1. VALIDACIÓN DE ABONO 50% ---
        if ($nuevo_estado === 'En Desarrollo' || $nuevo_estado === 'Desarrollo Inicial') {
            $queryValidar = "SELECT 
                                monto_bruto,
                                (SELECT COALESCE(SUM(monto), 0) FROM pagos_proyectos WHERE proyecto_id = p.id) as total_pagado
                             FROM proyectos p 
                             WHERE id = :id";
            $stmtV = $conn->prepare($queryValidar);
            $stmtV->execute([':id' => $proyecto_id]);
            $validacion = $stmtV->fetch(PDO::FETCH_ASSOC);

            if ($validacion) {
                $monto_bruto = (float)$validacion['monto_bruto'];
                $total_pagado = (float)$validacion['total_pagado'];
                $minimo_50 = $monto_bruto * 0.5;

                if ($total_pagado < $minimo_50) {
                    http_response_code(403);
                    echo json_encode([
                        "status" => "error", 
                        "message" => "Bloqueo de Seguridad: Abono insuficiente. Falta registrar $" . number_format($minimo_50 - $total_pagado, 0, ',', '.')
                    ]);
                    exit;
                }
            }
        }

        // --- 2. VALIDACIÓN DINÁMICA DE REVISIONES ---
        if (strpos($nuevo_estado, 'Revisión') !== false) {
            preg_match('/\d+/', $nuevo_estado, $matches);
            $num_revision_solicitada = isset($matches[0]) ? (int)$matches[0] : 0;

            if ($num_revision_solicitada > 0) {
                $queryRev = "SELECT revisiones_usadas, revisiones_totales FROM proyectos WHERE id = :id";
                $stmtR = $conn->prepare($queryRev);
                $stmtR->execute([':id' => $proyecto_id]);
                $revData = $stmtR->fetch(PDO::FETCH_ASSOC);

                if ($revData) {
                    if ($num_revision_solicitada > ($revData['revisiones_usadas'] + 1)) {
                        http_response_code(403);
                        echo json_encode([
                            "status" => "error", 
                            "message" => "Bloqueo: Debes marcar la 'Revisión " . ($num_revision_solicitada - 1) . "' en el Control de Revisiones antes de avanzar."
                        ]);
                        exit;
                    }
                    if ($num_revision_solicitada > $revData['revisiones_totales']) {
                        http_response_code(403);
                        echo json_encode([
                            "status" => "error", 
                            "message" => "Bloqueo: El proyecto solo incluye " . $revData['revisiones_totales'] . " revisiones."
                        ]);
                        exit;
                    }
                }
            }
        }

        // --- 3. VALIDACIÓN DE CIERRE FINAL (ESTADO "Cobrado") ---
        if ($nuevo_estado === 'Cobrado') {
            $queryCobro = "SELECT 
                                monto_bruto,
                                (SELECT COALESCE(SUM(monto), 0) FROM pagos_proyectos WHERE proyecto_id = p.id) as total_pagado,
                                (SELECT COALESCE(SUM(monto_bruto), 0) FROM costos_extra WHERE proyecto_id = p.id) as total_gastos
                            FROM proyectos p 
                            WHERE id = :id";
            $stmtC = $conn->prepare($queryCobro);
            $stmtC->execute([':id' => $proyecto_id]);
            $checkCobro = $stmtC->fetch(PDO::FETCH_ASSOC);

            if ($checkCobro) {
                $total_contrato = (float)$checkCobro['monto_bruto'] + (float)$checkCobro['total_gastos'];
                $pagado = (float)$checkCobro['total_pagado'];
                $saldo = $total_contrato - $pagado;

                if ($saldo > 1) {
                    http_response_code(403);
                    echo json_encode([
                        "status" => "error", 
                        "message" => "Bloqueo: No se puede cobrar. Saldo pendiente de $" . number_format($saldo, 0, ',', '.')
                    ]);
                    exit;
                }
            }
        }

        // --- 4. ACTUALIZACIÓN DEL ESTADO ---
        $query = "UPDATE proyectos SET estado = :estado WHERE id = :id";
        $stmt = $conn->prepare($query);
        $resultado = $stmt->execute([
            ":estado" => $nuevo_estado,
            ":id"     => $proyecto_id
        ]);

        if ($resultado) {

            // ── HITO: Proyecto Cobrado ───────────────────────────────────────
            if ($nuevo_estado === 'Cobrado') {
                $qHitoCobrado = "SELECT COUNT(*) as total FROM seguimiento_proyecto 
                                 WHERE proyecto_id = :pid 
                                 AND descripcion = '[HITO] Pago total verificado. Proyecto marcado como Cobrado y Finalizado'";
                $stmtHC = $conn->prepare($qHitoCobrado);
                $stmtHC->execute([':pid' => $proyecto_id]);
                $hitoCobradoExiste = (int)$stmtHC->fetch(PDO::FETCH_ASSOC)['total'];

                if ($hitoCobradoExiste === 0) {
                    $fecha_cobrado = date('Y-m-d H:i:s'); // America/Santiago
                    $qInsertCobrado = "INSERT INTO seguimiento_proyecto
                                           (proyecto_id, tipo, descripcion, duracion_minutos, fecha)
                                       VALUES (:pid, 'Hito',
                                           '[HITO] Pago total verificado. Proyecto marcado como Cobrado y Finalizado',
                                           0, :fecha)";
                    $stmtIC = $conn->prepare($qInsertCobrado);
                    $stmtIC->execute([':pid' => $proyecto_id, ':fecha' => $fecha_cobrado]);
                }
            }

            // ── REGLA 4: Hito "Inicio de Desarrollo Real" ───────────────────
            if ($nuevo_estado === 'Desarrollo Inicial') {
                $qHitoExiste = "SELECT COUNT(*) as total FROM seguimiento_proyecto 
                                WHERE proyecto_id = :pid 
                                AND tipo = 'Nota' 
                                AND descripcion = '[HITO] Inicio de Desarrollo Real'";
                $stmtHE = $conn->prepare($qHitoExiste);
                $stmtHE->execute([':pid' => $proyecto_id]);
                $hitoExiste = (int)$stmtHE->fetch(PDO::FETCH_ASSOC)['total'];

                if ($hitoExiste === 0) {
                    $fecha_hito = date('Y-m-d H:i:s'); // America/Santiago
                    $qHito = "INSERT INTO seguimiento_proyecto
                                  (proyecto_id, tipo, descripcion, duracion_minutos, fecha)
                              VALUES (:pid, 'Nota', '[HITO] Inicio de Desarrollo Real', 0, :fecha)";
                    $stmtH = $conn->prepare($qHito);
                    $stmtH->execute([':pid' => $proyecto_id, ':fecha' => $fecha_hito]);
                }
            }

            // ── REGLA 5: Métrica de Entrega (Lead Time) ─────────────────────
            $lead_time_dias  = null;
            $lead_time_horas = null;
            if ($nuevo_estado === 'Finalizado') {
                $qFecha = "SELECT fecha_aceptacion FROM proyectos WHERE id = :id AND fecha_aceptacion IS NOT NULL";
                $stmtFA = $conn->prepare($qFecha);
                $stmtFA->execute([':id' => $proyecto_id]);
                $rowFecha = $stmtFA->fetch(PDO::FETCH_ASSOC);

                if ($rowFecha && !empty($rowFecha['fecha_aceptacion'])) {
                    // Ambos DateTime en Santiago para que el diff sea correcto
                    $tz              = new DateTimeZone('America/Santiago');
                    $fechaAceptacion = new DateTime($rowFecha['fecha_aceptacion'], $tz);
                    $fechaAhora      = new DateTime('now', $tz);
                    $diff            = $fechaAhora->diff($fechaAceptacion);

                    $lead_time_dias  = $diff->days;
                    $lead_time_horas = ($diff->days * 24) + $diff->h;

                    $descripcionLeadTime = $lead_time_dias >= 1
                        ? "[HITO] Proyecto completado en {$lead_time_dias} día" . ($lead_time_dias !== 1 ? 's' : '') . " desde la firma del acuerdo"
                        : "[HITO] Proyecto completado en {$lead_time_horas} hora" . ($lead_time_horas !== 1 ? 's' : '') . " desde la firma del acuerdo";

                    $fecha_leadtime = date('Y-m-d H:i:s'); // America/Santiago
                    $qLeadTime = "INSERT INTO seguimiento_proyecto
                                      (proyecto_id, tipo, descripcion, duracion_minutos, fecha)
                                  VALUES (:pid, 'Nota', :desc, :mins, :fecha)";
                    $stmtLT = $conn->prepare($qLeadTime);
                    $stmtLT->execute([
                        ':pid'   => $proyecto_id,
                        ':desc'  => $descripcionLeadTime,
                        ':mins'  => $lead_time_horas * 60,
                        ':fecha' => $fecha_leadtime,
                    ]);
                }
            }

            $responseData = [
                "status"       => "success",
                "message"      => "Estado actualizado a " . $nuevo_estado,
                "nuevo_estado" => $nuevo_estado,
            ];

            if ($lead_time_dias !== null) {
                $responseData["lead_time_dias"]  = $lead_time_dias;
                $responseData["lead_time_horas"] = $lead_time_horas;
            }

            echo json_encode($responseData);

        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo actualizar en la base de datos"]);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "error" => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Datos incompletos."]);
}
?>