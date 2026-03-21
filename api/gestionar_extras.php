<?php
// ── Zona horaria Chile: evita que MySQL guarde en UTC ─────────────────────
date_default_timezone_set('America/Santiago');

include_once '../config/config.php';
header('Content-Type: application/json');

$data   = json_decode(file_get_contents("php://input"), true);
$metodo = $_SERVER['REQUEST_METHOD'];

try {

    // ── POST: Insertar nuevo costo extra ──────────────────────────────────
    if ($metodo === 'POST') {

        // Aceptar tanto 'monto_liquido' (legacy) como 'monto_neto' (frontend React)
        $monto_input = null;
        if (isset($data['monto_neto']))    $monto_input = (float)$data['monto_neto'];
        if (isset($data['monto_liquido'])) $monto_input = (float)$data['monto_liquido'];

        if (!isset($data['proyecto_id'], $data['descripcion']) || $monto_input === null) {
            throw new Exception("Datos incompletos: se requiere proyecto_id, descripcion y monto.");
        }

        $pid  = (int)$data['proyecto_id'];
        $desc = trim($data['descripcion']);
        $liq  = $monto_input;

        // monto_bruto: si el frontend lo envía pre-calculado lo usamos directamente.
        // Si no, tratamos el costo como reembolso 1:1 (sin gross-up).
        $bruto = isset($data['monto_bruto'])
            ? round((float)$data['monto_bruto'])
            : round($liq);

        // Visibilidad: 1 = visible al cliente, 0 = oculto (default 1)
        $visible = 1;
        if (isset($data['visible_cliente'])) {
            $visible = ($data['visible_cliente'] === true || $data['visible_cliente'] == 1) ? 1 : 0;
        }

        // ── Fecha explícita en zona horaria de Santiago ───────────────────
        // NUNCA usar NOW() o CURRENT_TIMESTAMP: MySQL corre en UTC en SiteGround.
        $fecha_registro = date('Y-m-d H:i:s');

        // ── INSERT con todos los campos ───────────────────────────────────
        $query = "INSERT INTO costos_extra
                    (proyecto_id, descripcion, monto_liquido, monto_bruto, visible_cliente, fecha_registro)
                  VALUES
                    (:pid, :desc, :liq, :bru, :vis, :fecha)";

        $stmt = $conn->prepare($query);
        $stmt->execute([
            ':pid'   => $pid,
            ':desc'  => $desc,
            ':liq'   => $liq,
            ':bru'   => $bruto,
            ':vis'   => $visible,
            ':fecha' => $fecha_registro,
        ]);

        $lastId = (int)$conn->lastInsertId();

        // ── Respuesta completa para el frontend ───────────────────────────
        // fecha_registro en la respuesta permite que CustomerView.tsx calcule
        // correctamente si el costo es "original" o "post-acuerdo" sin necesidad
        // de un refetch adicional.
        echo json_encode([
            "status"  => "success",
            "message" => "Costo agregado",
            "data"    => [
                "id"              => $lastId,
                "proyecto_id"     => $pid,
                "descripcion"     => $desc,
                "monto_liquido"   => $liq,
                "monto_bruto"     => $bruto,
                "visible_cliente" => $visible,
                "fecha_registro"  => $fecha_registro,
            ],
            // Duplicados en raíz para retrocompatibilidad con versiones anteriores
            "monto_bruto"    => $bruto,
            "fecha_registro" => $fecha_registro,
        ]);

    // ── DELETE: Eliminar costo extra ──────────────────────────────────────
    } elseif ($metodo === 'DELETE') {

        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) throw new Exception("ID no proporcionado o inválido.");

        $stmt = $conn->prepare("DELETE FROM costos_extra WHERE id = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode(["status" => "success", "message" => "Costo eliminado"]);

    // ── GET: Listar costos de un proyecto ─────────────────────────────────
    } else {

        $pid = isset($_GET['proyecto_id']) ? (int)$_GET['proyecto_id'] : 0;
        if ($pid <= 0) {
            echo json_encode([]);
            exit;
        }

        $query = "SELECT id, proyecto_id, descripcion, monto_liquido, monto_bruto,
                         visible_cliente, fecha_registro
                  FROM costos_extra
                  WHERE proyecto_id = :pid
                  ORDER BY id DESC";

        $stmt = $conn->prepare($query);
        $stmt->execute([':pid' => $pid]);
        $resultados = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Casteo de tipos para React
        foreach ($resultados as &$r) {
            $r['id']              = (int)$r['id'];
            $r['proyecto_id']     = (int)$r['proyecto_id'];
            $r['monto_liquido']   = (float)$r['monto_liquido'];
            $r['monto_bruto']     = (float)$r['monto_bruto'];
            $r['visible_cliente'] = (int)$r['visible_cliente'];
            // fecha_registro ya viene como 'YYYY-MM-DD HH:MM:SS' — sin cambios
        }

        echo json_encode($resultados);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>