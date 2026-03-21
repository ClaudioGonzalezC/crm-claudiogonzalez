<?php
include_once '../config/config.php';
header('Content-Type: application/json');

$proyecto_id = $_GET['proyecto_id'] ?? null;

if (!$proyecto_id) {
    echo json_encode([]);
    exit;
}

try {
    // Aseguramos que traemos nombre_archivo (el original) y nombre_servidor (el físico)
    $stmt = $conn->prepare("SELECT id, nombre_archivo, nombre_servidor, tipo_mime, peso_bytes, fecha_subida FROM archivos WHERE proyecto_id = ? ORDER BY fecha_subida DESC");
    $stmt->execute([$proyecto_id]);
    $archivos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($archivos as &$f) {
        $f['url'] = "https://crm.claudiogonzalez.dev/uploads/" . $f['nombre_servidor'];
        // Convertimos bytes a KB o MB para el frontend
        $f['peso_formateado'] = ($f['peso_bytes'] >= 1048576) 
            ? number_format($f['peso_bytes'] / 1048576, 2) . ' MB' 
            : number_format($f['peso_bytes'] / 1024, 2) . ' KB';
    }
    
    echo json_encode($archivos);
} catch (PDOException $e) {
    echo json_encode(["error" => $e->getMessage()]);
}