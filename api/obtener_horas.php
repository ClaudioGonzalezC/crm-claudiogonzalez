<?php
include_once '../config/config.php';
header('Content-Type: application/json');

$proyecto_id = isset($_GET['proyecto_id']) ? (int)$_GET['proyecto_id'] : 0;

if ($proyecto_id > 0) {
    try {
        $query = "SELECT id, horas, descripcion, fecha_trabajo 
                  FROM bitacora_horas 
                  WHERE proyecto_id = :pid 
                  ORDER BY fecha_trabajo DESC";
        $stmt = $conn->prepare($query);
        $stmt->execute([':pid' => $proyecto_id]);
        $registros = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($registros);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
} else {
    echo json_encode([]);
}