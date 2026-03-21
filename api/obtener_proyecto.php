<?php
include_once '../config/config.php';
header('Content-Type: application/json');

// Validar que el ID exista
$id = isset($_GET['id']) ? $_GET['id'] : null;

if (!$id) {
    http_response_code(400);
    echo json_encode(["error" => "ID no proporcionado"]);
    exit;
}

try {
    // 1. Usamos alias consistentes: nombre_empresa -> cliente_nombre
    // 2. Traemos explícitamente las revisiones con el nombre que espera el frontend
    $query = "SELECT p.*, 
                     c.nombre_empresa AS cliente_nombre,
                     p.revisiones_totales AS revisiones_incluidas
              FROM proyectos p 
              JOIN clientes c ON p.cliente_id = c.id 
              WHERE p.id = :id";
              
    $stmt = $conn->prepare($query);
    $stmt->execute([':id' => $id]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($proyecto) {
        // Forzar tipos numéricos para evitar que JS los trate como texto
        $proyecto['id'] = (int)$proyecto['id'];
        $proyecto['revisiones_incluidas'] = (int)$proyecto['revisiones_incluidas'];
        $proyecto['revisiones_usadas'] = (int)$proyecto['revisiones_usadas'];
        $proyecto['horas_estimadas'] = (float)$proyecto['horas_estimadas'];
        $proyecto['valor_hora_acordado'] = (float)$proyecto['valor_hora_acordado'];
        
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