<?php
/**
 * /api/v2/settings
 * GET  — retorna todos los settings como objeto key → value
 * PUT  — actualiza uno o más settings por clave
 *
 * Tabla: settings (id, key, value, created_at)
 * Source of truth: /docs/crm_spec.md
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include_once '../../config/config.php';

// Claves permitidas — definidas en crm_spec.md, sección "settings"
const ALLOWED_KEYS = [
    'monthly_overhead',
    'effective_hourly_cost',
    'monthly_capacity_hours',
    'min_profit_margin_pct',
    'retention_rate_2026',
];

$method = $_SERVER['REQUEST_METHOD'];

try {

    // ─────────────────────────────────────────────
    // GET — devuelve todos los settings
    // ─────────────────────────────────────────────
    if ($method === 'GET') {

        $stmt = $conn->query("SELECT `key`, value FROM settings ORDER BY `key`");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error'   => 'No settings found. Run seed script.',
            ]);
            exit;
        }

        // Convertir array de filas en objeto key → value
        $data = [];
        foreach ($rows as $row) {
            $data[$row['key']] = (float) $row['value'];
        }

        echo json_encode([
            'success' => true,
            'data'    => $data,
        ]);

    // ─────────────────────────────────────────────
    // PUT — actualiza uno o más settings
    // Body: { "monthly_overhead": 900000, ... }
    // ─────────────────────────────────────────────
    } elseif ($method === 'PUT') {

        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input || !is_array($input)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error'   => 'Body JSON inválido o vacío.',
            ]);
            exit;
        }

        $stmt    = $conn->prepare("UPDATE settings SET value = :value WHERE `key` = :key");
        $updated = [];
        $skipped = [];

        foreach ($input as $key => $value) {

            // Rechazar claves no permitidas
            if (!in_array($key, ALLOWED_KEYS, true)) {
                $skipped[] = $key;
                continue;
            }

            // Validar que el valor sea numérico
            if (!is_numeric($value)) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'error'   => "El valor de '$key' debe ser numérico.",
                ]);
                exit;
            }

            $stmt->execute([':key' => $key, ':value' => (float) $value]);

            if ($stmt->rowCount() > 0) {
                $updated[] = $key;
            }
        }

        echo json_encode([
            'success' => true,
            'message' => 'Settings actualizados.',
            'updated' => $updated,
            'skipped' => $skipped,   // claves ignoradas por no estar en ALLOWED_KEYS
        ]);

    // ─────────────────────────────────────────────
    // Método no soportado
    // ─────────────────────────────────────────────
    } else {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'error'   => 'Método no permitido. Usa GET o PUT.',
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'DB error: ' . $e->getMessage(),
    ]);
}
?>
