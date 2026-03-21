<?php
include_once '../config/config.php';
header('Content-Type: application/json');
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

// TIMEZONE: Siempre operar en hora de Chile para que los timestamps sean correctos
date_default_timezone_set('America/Santiago');

$data   = json_decode(file_get_contents("php://input"));
$metodo = $_SERVER['REQUEST_METHOD'];

try {
    // --- 1. DETECCIÓN DE ID PARA ELIMINAR ---
    $nota_id = isset($_GET['id'])   ? (int)$_GET['id']   :
               (isset($data->id)   ? (int)$data->id      : 0);

    if ($nota_id > 0 && ($metodo == 'DELETE' || ($metodo == 'POST' && empty($data->proyecto_id)))) {
        $query = "DELETE FROM seguimiento_proyecto WHERE id = :id AND tipo = 'Nota'";
        $stmt  = $conn->prepare($query);
        $stmt->execute([':id' => $nota_id]);

        echo json_encode(["status" => "success", "message" => "Nota eliminada correctamente", "id" => $nota_id]);
        exit;
    }

    // --- 2. CREAR NOTA (POST) ---
    if ($metodo == 'POST') {
        $descripcion = !empty($data->nota)       ? $data->nota
                     : (!empty($data->descripcion) ? $data->descripcion : '');

        if (empty($data->proyecto_id) || empty($descripcion)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Datos incompletos. Se requiere proyecto_id y nota."]);
            exit;
        }

        // La columna `fecha` es TIMESTAMP con DEFAULT CURRENT_TIMESTAMP.
        // Al no incluirla en el INSERT el motor MySQL usará su propia hora (UTC normalmente).
        // Para garantizar hora de Santiago, insertamos explícitamente con NOW() del PHP,
        // que ya tiene 'America/Santiago' activo.
        $fechaSantiago = date('Y-m-d H:i:s'); // ahora en America/Santiago

        $query = "INSERT INTO seguimiento_proyecto (proyecto_id, tipo, descripcion, fecha)
                  VALUES (:pid, 'Nota', :desc, :fecha)";

        $stmt = $conn->prepare($query);
        $stmt->execute([
            ':pid'   => $data->proyecto_id,
            ':desc'  => $descripcion,
            ':fecha' => $fechaSantiago,
        ]);

        $newId = $conn->lastInsertId();

        echo json_encode([
            "status"  => "success",
            "message" => "Nota guardada correctamente",
            "id"      => (int)$newId,
            // Devolvemos la fecha con offset explícito para que el frontend sepa la TZ
            "fecha"   => date('Y-m-d\TH:i:sP'), // ej: 2026-03-20T15:43:10-03:00
        ]);
        exit;
    }

    // --- 3. LISTAR NOTAS (GET) ---
    $pid = isset($_GET['proyecto_id']) ? (int)$_GET['proyecto_id'] : 0;

    if ($pid === 0) {
        echo json_encode([]);
        exit;
    }

    $query = "SELECT id, proyecto_id, descripcion AS nota, fecha
              FROM seguimiento_proyecto
              WHERE proyecto_id = :pid AND tipo = 'Nota'
              ORDER BY fecha DESC";

    $stmt = $conn->prepare($query);
    $stmt->execute([':pid' => $pid]);
    $notas = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($notas as &$n) {
        // Convertir la fecha almacenada (ya en Santiago gracias a la escritura corregida)
        // a ISO 8601 con offset para que el navegador siempre interprete bien
        if (!empty($n['fecha'])) {
            try {
                $dt = new DateTime($n['fecha'], new DateTimeZone('America/Santiago'));
                $n['fecha'] = $dt->format('Y-m-d\TH:i:sP'); // "2026-03-20T15:43:10-03:00"
            } catch (Exception $e) {
                // Si falla el parse, dejamos el string original
            }
        }
        $n['creado_por'] = 'Claudio G.';
    }
    unset($n);

    echo json_encode($notas, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}