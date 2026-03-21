/**
 * financial.ts — Fuente de Verdad Única para lógica tributaria (SII Chile)
 * =========================================================================
 * REGLAS PERMANENTES DEL SISTEMA — NO MODIFICAR SIN REVISIÓN CONTABLE
 *
 * REGLA 1 — Retención SII (Honorarios)
 *   Tasa: 15.25%
 *   Aplica a: Honorarios profesionales únicamente.
 *   NO aplica a: costos extra visibles (reembolsos directos).
 *
 * REGLA 2 — Costos Extra VISIBLES (Reembolso Directo)
 *   El cliente paga el monto neto → tú recibes el monto neto.
 *   monto_bruto = monto_neto (1:1, sin gross-up)
 *   Impacto en boleta: NINGUNO. No se boletean, no llevan retención.
 *
 * REGLA 3 — Costos Extra OCULTOS (Honorario Adicional / Internalizado)
 *   Se tratan como honorario: el cliente NO ve el ítem, pero se boletea
 *   dentro de los honorarios. Para recibir el monto_liquido deseado tras
 *   la retención, se aplica Gross-Up:
 *     monto_bruto = monto_liquido_deseado / (1 - RETENTION_RATE)
 *                 = monto_liquido_deseado / 0.8475
 *   Impacto en boleta: Se suma a la base de honorarios brutos.
 *
 * REGLA 4 — Fórmula de Utilidad Real (Dashboard)
 *   utilidad = (honorarios_brutos × 0.8475) + gastos_extra_brutos_visibles
 *   Los gastos visibles entran 1:1; los ocultos ya están dentro de honorarios.
 */

// ── Constantes base ──────────────────────────────────────────────────────────

/** Tasa de retención SII para honorarios: 15.25% */
export const RETENTION_RATE = 0.1525;

/** Factor líquido: lo que queda después de la retención (1 - 0.1525) */
export const LIQUID_FACTOR = 0.8475;

/** Factor de Gross-Up para costos ocultos: 1 / (1 - RETENTION_RATE) */
export const GROSS_UP_FACTOR = 1 / LIQUID_FACTOR; // ≈ 1.18

// ── Funciones de cálculo ─────────────────────────────────────────────────────

/**
 * Calcula la retención SII sobre un monto bruto de honorarios.
 * @param brutAmount - Monto bruto a boletear
 */
export const calculateRetention = (brutAmount: number): number =>
  Math.round(brutAmount * RETENTION_RATE);

/**
 * Calcula el monto líquido después de retención SII.
 * @param brutAmount - Monto bruto a boletear
 */
export const calculateLiquid = (brutAmount: number): number =>
  Math.round(brutAmount * LIQUID_FACTOR);

/**
 * REGLA 3 — Gross-Up para costos ocultos.
 * Dado el monto líquido que quieres recibir, calcula el bruto que
 * debes declarar para que, tras la retención del 15.25%, recibas ese neto.
 *
 * Ejemplo: grossUp(84750) → 100000
 *   $100.000 × (1 - 0.1525) = $84.750 ✓
 *
 * Usa Math.round → para honorarios / costos ocultos.
 *
 * @param liquidDesired - Monto líquido que el profesional desea recibir
 */
export const grossUp = (liquidDesired: number): number =>
  Math.round(liquidDesired * GROSS_UP_FACTOR);

/**
 * Variante con Math.ceil — para costos visibles (reembolsos).
 * Garantiza que el bruto cubra siempre el neto deseado sin "peso faltante".
 * Ejemplo: grossUpCeil(10000) → 11800 (vs round → 11799)
 */
export const grossUpCeil = (liquidDesired: number): number =>
  Math.ceil(liquidDesired * GROSS_UP_FACTOR);

/**
 * REGLA 2/3 — Calcula monto_bruto de un costo extra según su visibilidad.
 *
 * - visible  → grossUpCeil(monto_neto)  evita "peso faltante" en reembolsos
 * - oculto   → grossUp(monto_neto)      internalizado como honorario (round)
 *
 * Ambos modelos hacen gross-up; la diferencia es el redondeo:
 *   oculto  ceil(10000/0.8475) = 11799  (Math.round)
 *   visible ceil(10000/0.8475) = 11800  (Math.ceil)
 * Suma: 1.000.000 + 11799 + 11800 = 1.023.599 ✓
 *
 * @param montoNeto      - Monto que el profesional desea recibir / pagó
 * @param visibleCliente - true = reembolso visible, false = honorario internalizado
 */
export const calcCostoExtraBruto = (
  montoNeto: number,
  visibleCliente: boolean
): number =>
  visibleCliente ? grossUpCeil(montoNeto) : grossUp(montoNeto);

// ── Tipos de utilidad ────────────────────────────────────────────────────────

export interface CostoExtraFinanciero {
  id: number;
  descripcion: string;
  monto_liquido: number;
  monto_bruto: number;
  visible_cliente: number | boolean;
}

/**
 * Separa los costos extra en dos grupos para el cálculo de boleta.
 * - visibles  → van DESPUÉS de la retención (reembolsos)
 * - ocultos   → van DENTRO de la base de honorarios brutos (gross-up)
 */
export const segregarCostosExtra = (costos: CostoExtraFinanciero[]) => {
  const visibles = costos.filter(
    (c) => c.visible_cliente === 1 || c.visible_cliente === true
  );
  const ocultos = costos.filter(
    (c) => c.visible_cliente === 0 || c.visible_cliente === false
  );
  return { visibles, ocultos };
};
