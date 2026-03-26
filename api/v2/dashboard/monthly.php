<?php
/**
 * /api/v2/dashboard/monthly.php
 *
 * GET (sin params)         → mes actual (timezone: America/Santiago)
 * GET ?year=2026&month=3   → mes específico → monthly_summary
 * GET ?year=2026           → todos los meses del año → months[] + year_totals
 *                            NO retorna monthly_summary en modo año
 *
 * Fuentes de datos:
 *   monthly_control    → agregados financieros por año/mes (Fase 1 Block 3)
 *   dashboard_metrics  → snapshot actual de proyectos por status_v2 (sin filtro mensual)
 *
 * Reglas:
 *   - resultado_mes se lee de monthly_control directamente, no se recalcula
 *   - project_status_overview es snapshot actual (dashboard_metrics sin WHERE de mes)
 *   - available_periods retorna [{year, month, label}] desde monthly_control
 *   - ?month sin ?year → 400
 *   - timezone por defecto: America/Santiago
 *
 * Source of truth: /docs/crm_spec.md
 * No modifica DB. No toca vistas. No toca endpoints anteriores.
 */

date_default_timezone_set('America/Santiago');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido. Usa GET.']);
    exit;
}

include_once '../../../config/config.php';

// ─────────────────────────────────────────────────────────────
// HELPER — etiqueta de mes en español
// ─────────────────────────────────────────────────────────────
function monthLabel(int $year, int $month): string
{
    $nombres = [
        1  => 'Enero',   2  => 'Febrero',  3  => 'Marzo',
        4  => 'Abril',   5  => 'Mayo',     6  => 'Junio',
        7  => 'Julio',   8  => 'Agosto',   9  => 'Septiembre',
        10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    ];
    return ($nombres[$month] ?? "Mes $month") . ' ' . $year;
}

// ─────────────────────────────────────────────────────────────
// HELPER — estructura vacía para un mes sin datos
// ─────────────────────────────────────────────────────────────
function emptyMonth(): array
{
    return [
        'bruto_mes'      => 0.0,
        'retencion_mes'  => 0.0,
        'liquido_mes'    => 0.0,
        'liquido_cobrado'=> 0.0,
        'f29_pendientes' => 0,
        'gastos_mes'     => 0.0,
        'horas_mes'      => 0.0,
        'resultado_mes'  => 0.0,
    ];
}

// ─────────────────────────────────────────────────────────────
// HELPER — normalizar fila de monthly_control
// ─────────────────────────────────────────────────────────────
function normalizeRow(array $row): array
{
    return [
        'bruto_mes'      => (float) $row['bruto_mes'],
        'retencion_mes'  => (float) $row['retencion_mes'],
        'liquido_mes'    => (float) $row['liquido_mes'],
        'liquido_cobrado'=> (float) $row['liquido_cobrado'],
        'f29_pendientes' => (int)   $row['f29_pendientes'],
        'gastos_mes'     => (float) $row['gastos_mes'],
        'horas_mes'      => (float) $row['horas_mes'],
        'resultado_mes'  => (float) $row['resultado_mes'], // leído directo de la vista
    ];
}

// ─────────────────────────────────────────────────────────────
// HELPER — snapshot de proyectos por status_v2 (global, sin filtro mensual)
// ─────────────────────────────────────────────────────────────
function getProjectStatusOverview(PDO $conn): array
{
    $stmt = $conn->query("
        SELECT estado_v2,
               total_proyectos,
               total_horas,
               avg_stress,
               total_net_profit,
               proyectos_cerrados,
               proyectos_activos,
               con_eval_previa,
               con_eval_emocional,
               con_profit_calculado
        FROM   dashboard_metrics
        ORDER  BY FIELD(
                    estado_v2,
                    'Draft','Evaluating','Quoted','Approved',
                    'Executing','Boleta','Closed','Legacy'
                  )
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$r) {
        $r['total_proyectos']      = (int)   $r['total_proyectos'];
        $r['total_horas']          = (float) $r['total_horas'];
        $r['avg_stress']           = $r['avg_stress'] !== null ? (float) $r['avg_stress'] : null;
        $r['total_net_profit']     = (float) $r['total_net_profit'];
        $r['proyectos_cerrados']   = (int)   $r['proyectos_cerrados'];
        $r['proyectos_activos']    = (int)   $r['proyectos_activos'];
        $r['con_eval_previa']      = (int)   $r['con_eval_previa'];
        $r['con_eval_emocional']   = (int)   $r['con_eval_emocional'];
        $r['con_profit_calculado'] = (int)   $r['con_profit_calculado'];
    }
    unset($r);

    return $rows;
}

// ─────────────────────────────────────────────────────────────
// HELPER — períodos disponibles desde monthly_control
//          Retorna [{year, month, label}] ordenados desc
// ─────────────────────────────────────────────────────────────
function getAvailablePeriods(PDO $conn): array
{
    $stmt = $conn->query("
        SELECT DISTINCT year, month
        FROM   monthly_control
        ORDER  BY year DESC, month DESC
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return array_map(function ($r) {
        return [
            'year'  => (int) $r['year'],
            'month' => (int) $r['month'],
            'label' => monthLabel((int) $r['year'], (int) $r['month']),
        ];
    }, $rows);
}

// ─────────────────────────────────────────────────────────────
// PARSEAR PARÁMETROS
// ─────────────────────────────────────────────────────────────
$has_year  = isset($_GET['year'])  && $_GET['year']  !== '';
$has_month = isset($_GET['month']) && $_GET['month'] !== '';

// ?month sin ?year → 400
if ($has_month && !$has_year) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'year es obligatorio cuando se envía month.']);
    exit;
}

// Determinar modo: 'month' | 'year' | 'default'
if ($has_year && $has_month) {
    $mode  = 'month';
    $year  = (int) $_GET['year'];
    $month = (int) $_GET['month'];
} elseif ($has_year) {
    $mode  = 'year';
    $year  = (int) $_GET['year'];
    $month = null;
} else {
    // Default: mes actual en America/Santiago
    $mode  = 'month';
    $year  = (int) date('Y');
    $month = (int) date('n');
}

// Validar rangos
if (isset($year) && ($year < 2000 || $year > 2100)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'year fuera de rango (2000–2100).']);
    exit;
}
if ($mode === 'month' && ($month < 1 || $month > 12)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'month debe estar entre 1 y 12.']);
    exit;
}

// ─────────────────────────────────────────────────────────────
// EJECUTAR QUERIES
// ─────────────────────────────────────────────────────────────
try {

    $available_periods      = getAvailablePeriods($conn);
    $project_status_overview = getProjectStatusOverview($conn);

    // ── MODO MES ESPECÍFICO ───────────────────────────────────
    if ($mode === 'month') {

        $stmt = $conn->prepare("
            SELECT bruto_mes, retencion_mes, liquido_mes,
                   liquido_cobrado, f29_pendientes,
                   gastos_mes, horas_mes, resultado_mes
            FROM   monthly_control
            WHERE  year  = :year
              AND  month = :month
            LIMIT  1
        ");
        $stmt->execute([':year' => $year, ':month' => $month]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $has_data       = (bool) $row;
        $monthly_summary = $row ? normalizeRow($row) : emptyMonth();

        echo json_encode([
            'success'  => true,
            'period'   => [
                'year'  => $year,
                'month' => $month,
                'label' => monthLabel($year, $month),
            ],
            'has_data'               => $has_data,
            'monthly_summary'        => $monthly_summary,
            'project_status_overview'=> $project_status_overview,
            'available_periods'      => $available_periods,
        ]);

    // ── MODO AÑO COMPLETO ─────────────────────────────────────
    } elseif ($mode === 'year') {

        $stmt = $conn->prepare("
            SELECT month, bruto_mes, retencion_mes, liquido_mes,
                   liquido_cobrado, f29_pendientes,
                   gastos_mes, horas_mes, resultado_mes
            FROM   monthly_control
            WHERE  year = :year
            ORDER  BY month ASC
        ");
        $stmt->execute([':year' => $year]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Construir array de meses con label
        $months_data = [];
        $year_totals = [
            'bruto_total'       => 0.0,
            'retencion_total'   => 0.0,
            'liquido_total'     => 0.0,
            'liquido_cobrado'   => 0.0,
            'f29_pendientes'    => 0,
            'gastos_total'      => 0.0,
            'horas_total'       => 0.0,
            'resultado_total'   => 0.0,
        ];

        foreach ($rows as $row) {
            $m   = (int) $row['month'];
            $normalized = normalizeRow($row);

            $months_data[] = array_merge(
                ['month' => $m, 'label' => monthLabel($year, $m)],
                $normalized
            );

            // Acumular totales anuales (no recalcular, sumar lo que devuelve la vista)
            $year_totals['bruto_total']     += $normalized['bruto_mes'];
            $year_totals['retencion_total'] += $normalized['retencion_mes'];
            $year_totals['liquido_total']   += $normalized['liquido_mes'];
            $year_totals['liquido_cobrado'] += $normalized['liquido_cobrado'];
            $year_totals['f29_pendientes']  += $normalized['f29_pendientes'];
            $year_totals['gastos_total']    += $normalized['gastos_mes'];
            $year_totals['horas_total']     += $normalized['horas_mes'];
            $year_totals['resultado_total'] += $normalized['resultado_mes'];
        }

        // Redondear totales
        foreach ($year_totals as $k => $v) {
            $year_totals[$k] = is_float($v) ? round($v, 2) : $v;
        }

        echo json_encode([
            'success' => true,
            'period'  => [
                'year'  => $year,
                'month' => null,
                'label' => (string) $year,
            ],
            'has_data'               => count($months_data) > 0,
            'months'                 => $months_data,
            'year_totals'            => $year_totals,
            'project_status_overview'=> $project_status_overview,
            'available_periods'      => $available_periods,
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB error: ' . $e->getMessage()]);
}
?>
