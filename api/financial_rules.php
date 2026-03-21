<?php
/**
 * financial_rules.php — Fuente de Verdad Única para lógica tributaria SII Chile
 * ===============================================================================
 * REGLAS PERMANENTES DEL SISTEMA — Espejo de client/src/constants/financial.ts
 * NO MODIFICAR SIN REVISIÓN CONTABLE.
 *
 * REGLA 1 — Retención SII (Honorarios)
 *   Tasa: 15.25%  |  Factor líquido: 0.8475  |  Factor bruto (gross-up): 1 / 0.8475
 *   Aplica a: Honorarios profesionales + costos extra OCULTOS internalizados.
 *   NO aplica a: costos extra VISIBLES (son reembolsos directos).
 *
 * REGLA 2 — Costos Extra VISIBLES (Reembolso Directo)
 *   El cliente ve el ítem y paga el monto neto → profesional recibe el monto neto.
 *   monto_bruto = monto_neto  (1:1, sin gross-up, no se boletean)
 *
 * REGLA 3 — Costos Extra OCULTOS (Honorario Internalizado / Gross-Up)
 *   El cliente NO ve el ítem; se absorbe dentro de los honorarios de la boleta.
 *   Para recibir $X neto tras retención 15.25%:
 *     monto_bruto = monto_neto / 0.8475  (gross-up)
 *   Ejemplo: grossUp(84750) = 100000 → 100000×0.8475 = 84750 ✓
 *
 * REGLA 4 — Utilidad Real (Dashboard / get_proyectos_stats.php)
 *   utilidad = (honorarios_brutos × 0.8475) + gastos_visibles_brutos
 *   Los ocultos ya están dentro de honorarios; los visibles entran 1:1 sin retención.
 *
 * REGLA 5 — Total Contrato (lo que cobra el cliente)
 *   = monto_bruto_honorarios + SUM(costos_extra.monto_bruto)
 *   (los ocultos ya tienen el gross-up aplicado en BD, así que el cliente
 *    los paga sin saberlo dentro de los honorarios si el bruto se ajustó)
 */

// ── Constantes ────────────────────────────────────────────────────────────────
define('SII_RETENCION_RATE',  0.1525);   // 15.25%
define('SII_LIQUID_FACTOR',   0.8475);   // 1 - 0.1525
define('SII_GROSS_UP_FACTOR', 1 / 0.8475); // ≈ 1.179941...

// ── Funciones helper ──────────────────────────────────────────────────────────

/**
 * Retención SII sobre monto bruto de honorarios.
 */
function calcRetencion(float $bruto): int {
    return (int) round($bruto * SII_RETENCION_RATE);
}

/**
 * Monto líquido tras retención.
 */
function calcLiquido(float $bruto): int {
    return (int) round($bruto * SII_LIQUID_FACTOR);
}

/**
 * Gross-up: bruto necesario para recibir $neto después de retención.
 * REGLA 3.
 */
function grossUp(float $neto): int {
    return (int) round($neto / SII_LIQUID_FACTOR);
}

/**
 * monto_bruto de un costo extra según visibilidad.
 * REGLA 2 (visible) y REGLA 3 (oculto).
 *
 * @param float $monto_neto     Lo que el profesional desea recibir / pagó
 * @param int   $visible        1 = visible (reembolso), 0 = oculto (gross-up)
 */
function costoExtraBruto(float $monto_neto, int $visible): int {
    return $visible === 1
        ? (int) round($monto_neto)   // REGLA 2: 1:1
        : grossUp($monto_neto);      // REGLA 3: gross-up
}

/**
 * Utilidad real de un conjunto de pagos + costos extras del mismo período.
 * REGLA 4.
 *
 * @param float $pagos_brutos_total     SUM(pagos_proyectos.monto) del período
 * @param float $gastos_visibles_brutos SUM(costos_extra.monto_bruto) WHERE visible_cliente=1
 * @param float $gastos_ocultos_brutos  SUM(costos_extra.monto_bruto) WHERE visible_cliente=0
 *
 * Los ocultos ya están gross-upped → se procesan como honorarios (llevan retención).
 * Los visibles son reembolsos → entran 1:1 sin retención.
 *
 * base_boleta = pagos_totales - gastos_visibles_brutos  (lo que va a la boleta)
 * liquido_boleta = base_boleta × 0.8475
 * utilidad = liquido_boleta + gastos_visibles_brutos
 */
function calcUtilidadReal(
    float $pagos_brutos_total,
    float $gastos_visibles_brutos
): int {
    $base_boleta    = max(0.0, $pagos_brutos_total - $gastos_visibles_brutos);
    $liquido_boleta = round($base_boleta * SII_LIQUID_FACTOR);
    return (int) round($liquido_boleta + $gastos_visibles_brutos);
}

/**
 * Total de contrato real para un proyecto (lo que el cliente debe pagar en total).
 * REGLA 5.
 *
 * = monto_bruto_honorarios + SUM(costos_extra.monto_bruto)
 * (ocultos ya tienen gross-up; visibles son 1:1)
 */
function calcTotalContrato(float $honorarios_brutos, float $total_extras_brutos): int {
    return (int) round($honorarios_brutos + $total_extras_brutos);
}