<?php
include_once '../config/config.php';
header('Content-Type: application/json');
header("Cache-Control: no-cache, no-store, must-revalidate");

$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "ID del proyecto requerido"]);
    exit;
}

// ── Sanitizadores ──────────────────────────────────────────────────────────────
function sanitizeText(?string $val): ?string {
    if ($val === null || trim($val) === '') return null;
    return trim($val);
}

function sanitizeDate(?string $val): ?string {
    if ($val === null || trim($val) === '') return null;
    $v = trim($val);
    // Solo aceptar YYYY-MM-DD (lo que devuelve input[type=date])
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return null;
    return $v;
}

try {
    $proyecto_id = (int)$data->id;

    // ── Campos que puede actualizar este endpoint ──────────────────────────────
    // Activos digitales
    $dominio_nombre      = sanitizeText($data->dominio_nombre      ?? null);
    $dominio_provider    = sanitizeText($data->dominio_provider    ?? null);
    $dominio_vencimiento = sanitizeDate($data->dominio_vencimiento ?? null);
    $hosting_provider    = sanitizeText($data->hosting_provider    ?? null);
    $hosting_plan        = sanitizeText($data->hosting_plan        ?? null);
    $hosting_vencimiento = sanitizeDate($data->hosting_vencimiento ?? null);

    $query = "UPDATE proyectos SET
                dominio_nombre      = :dn,
                dominio_provider    = :dp,
                dominio_vencimiento = :dv,
                hosting_provider    = :hp,
                hosting_plan        = :hpl,
                hosting_vencimiento = :hv
              WHERE id = :id";

    $stmt = $conn->prepare($query);
    $stmt->execute([
        ":dn"  => $dominio_nombre,
        ":dp"  => $dominio_provider,
        ":dv"  => $dominio_vencimiento,
        ":hp"  => $hosting_provider,
        ":hpl" => $hosting_plan,
        ":hv"  => $hosting_vencimiento,
        ":id"  => $proyecto_id,
    ]);

    echo json_encode([
        "status"  => "success",
        "message" => "Activos digitales actualizados correctamente",
        "updated" => [
            "dominio_nombre"      => $dominio_nombre,
            "dominio_provider"    => $dominio_provider,
            "dominio_vencimiento" => $dominio_vencimiento,
            "hosting_provider"    => $hosting_provider,
            "hosting_plan"        => $hosting_plan,
            "hosting_vencimiento" => $hosting_vencimiento,
        ],
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>