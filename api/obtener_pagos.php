<?php
include_once '../config/config.php';
header('Content-Type: application/json');

$proyecto_id = isset($_GET['proyecto_id']) ? (int)$_GET['proyecto_id'] : 0;

if ($proyecto_id > 0) {
    try {
        $query = "SELECT id, monto, descripcion, fecha_pago FROM pagos_proyectos 
                  WHERE proyecto_id = :pid ORDER BY fecha_pago DESC";
        $stmt = $conn->prepare($query);
        $stmt->execute([':pid' => $proyecto_id]);
        $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($pagos);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
} else {
    echo json_encode([]);
}