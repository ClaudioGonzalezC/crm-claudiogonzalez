import { RETENTION_RATE, LIQUID_FACTOR } from "@/constants/financial";

/**
 * InvoiceSummary — Resumen de cobro durante la CREACIÓN del proyecto.
 *
 * MODELO UNIFICADO (idéntico a TotalCalculator):
 *   Base Boleta = Honorarios Brutos
 *               + SUM ocultos_bruto  (gross-up Math.round)
 *               + SUM visibles_bruto (gross-up Math.ceil)
 *   Retención   = Base Boleta × 15.25%
 *   Líquido     = Base Boleta − Retención   → $867.500
 *   Abono 50%   = Líquido × 0.5             → $433.750
 *   Bruto total = Base Boleta               → $1.023.599
 */

interface CostoExtra {
  descripcion: string;
  monto_neto: string;
  visible_cliente: boolean;
}

interface InvoiceSummaryProps {
  hours: number;
  hourlyRate: number;
  projectName: string;
  costosExtra?: CostoExtra[];
}

const formatCLP = (v: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export default function InvoiceSummary({
  hours,
  hourlyRate,
  projectName,
  costosExtra = [],
}: InvoiceSummaryProps) {

  if (hours === 0 || hourlyRate === 0) return null;

  // ── Honorarios ────────────────────────────────────────────────────────────
  const honorariosBrutos = Math.round(hours * hourlyRate);

  // ── Segregar y gross-up de costos ─────────────────────────────────────────
  const costoValidos = costosExtra.filter(
    (c) => c.monto_neto.trim() !== "" && !isNaN(Number(c.monto_neto)) && Number(c.monto_neto) > 0
  );

  const ocultosItems   = costoValidos.filter((c) => !c.visible_cliente);
  const visiblesItems  = costoValidos.filter((c) => c.visible_cliente);

  // Gross-up sobre total neto (no ítem a ítem) para evitar error acumulativo
  const ocultosNetoTotal   = ocultosItems.reduce((s, c) => s + Number(c.monto_neto), 0);
  const visiblesNetoTotal  = visiblesItems.reduce((s, c) => s + Number(c.monto_neto), 0);

  const ocultosBrutoTotal  = ocultosNetoTotal  > 0 ? Math.round(ocultosNetoTotal  / LIQUID_FACTOR) : 0;
  const visiblesBrutoTotal = visiblesNetoTotal > 0 ? Math.ceil(visiblesNetoTotal  / LIQUID_FACTOR) : 0;

  // ── Boleta ─────────────────────────────────────────────────────────────────
  const baseBoleta   = honorariosBrutos + ocultosBrutoTotal + visiblesBrutoTotal;
  const retencion    = Math.round(baseBoleta * RETENTION_RATE);
  const liquidoTotal = baseBoleta - retencion;   // $867.500
  const abono50      = Math.round(liquidoTotal * 0.5); // $433.750

  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-slate-900/30 backdrop-blur border border-blue-500/20 rounded-2xl p-8 space-y-4">

      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white">Resumen de Cobro</h3>
        {projectName && <p className="text-gray-400 text-sm mt-1">Proyecto: {projectName}</p>}
      </div>

      {/* ══ BOLETA ════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-blue-500/20 overflow-hidden">
        <div className="px-5 py-3 bg-blue-500/10 border-b border-blue-500/20">
          <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">
            💼 Tu Pago — Base de Boleta (SII)
          </p>
        </div>
        <div className="p-5 space-y-2.5">

          {/* Honorarios */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-300 text-sm">Honorarios Brutos</p>
              <p className="text-gray-500 text-xs mt-0.5">{hours}h × {formatCLP(hourlyRate)}</p>
            </div>
            <p className="text-blue-300 font-semibold">{formatCLP(honorariosBrutos)}</p>
          </div>

          {/* Ocultos — gross-up round */}
          {ocultosItems.length > 0 && (
            <div className="space-y-1.5 pl-4 border-l-2 border-slate-600/40">
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Costos ocultos — internalizados
              </p>
              {ocultosItems.map((c, i) => {
                const neto  = Number(c.monto_neto);
                const bruto = Math.round(neto / LIQUID_FACTOR);
                return (
                  <div key={i} className="flex justify-between items-center">
                    <p className="text-gray-400 text-xs">
                      🔒 {c.descripcion}
                      <span className="text-gray-600 ml-1">({formatCLP(neto)} neto / 0.8475)</span>
                    </p>
                    <p className="text-gray-300 text-xs font-semibold">+ {formatCLP(bruto)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Visibles — gross-up ceil */}
          {visiblesItems.length > 0 && (
            <div className="space-y-1.5 pl-4 border-l-2 border-cyan-600/30">
              <p className="text-cyan-500/70 text-xs uppercase tracking-wider">
                Reembolsos del cliente — incluidos en boleta
              </p>
              {visiblesItems.map((c, i) => {
                const neto  = Number(c.monto_neto);
                const bruto = Math.ceil(neto / LIQUID_FACTOR);
                return (
                  <div key={i} className="flex justify-between items-center">
                    <p className="text-gray-400 text-xs">
                      🔄 {c.descripcion}
                      <span className="text-gray-600 ml-1">({formatCLP(neto)} neto / 0.8475↑)</span>
                    </p>
                    <p className="text-cyan-300/80 text-xs font-semibold">+ {formatCLP(bruto)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Base total (si hay costos) */}
          {(ocultosItems.length > 0 || visiblesItems.length > 0) && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-700/30">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Base total a boletear</p>
              <p className="text-blue-200 font-semibold">{formatCLP(baseBoleta)}</p>
            </div>
          )}

          {/* Retención */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">− Retención SII (15.25%)</p>
              {(ocultosItems.length > 0 || visiblesItems.length > 0) && (
                <p className="text-gray-600 text-xs mt-0.5">sobre {formatCLP(baseBoleta)}</p>
              )}
            </div>
            <p className="text-red-400 font-semibold">− {formatCLP(retencion)}</p>
          </div>

          {/* Total líquido */}
          <div className="flex justify-between items-center pt-2 border-t-2 border-slate-600/40">
            <div>
              <p className="text-white font-bold text-sm">= Total Líquido</p>
              <p className="text-gray-500 text-xs mt-0.5">Lo que recibirás en tu cuenta</p>
            </div>
            <p className="text-emerald-400 font-bold text-2xl">{formatCLP(liquidoTotal)}</p>
          </div>
        </div>
      </div>

      {/* ══ ABONO 50% ════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-amber-500/20 overflow-hidden">
        <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-amber-300 text-xs font-bold uppercase tracking-widest">
            Abono Inicial Requerido — 50%
          </p>
          <p className="text-amber-400/60 text-xs mt-0.5">
            {formatCLP(liquidoTotal)} × 50% = {formatCLP(abono50)}
          </p>
        </div>
        <div className="px-5 py-4 flex justify-between items-center">
          <p className="text-gray-400 text-sm">El cliente paga antes de iniciar</p>
          <p className="text-amber-300 font-bold text-2xl">{formatCLP(abono50)}</p>
        </div>
      </div>

      {/* ══ NOTA ═════════════════════════════════════════════════════════════ */}
      <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/30 space-y-1">
        <p className="text-gray-400 text-xs">
          💡 Boleta:{' '}
          <span className="text-gray-300 font-semibold">{formatCLP(baseBoleta)}</span>
          {' '}brutos → retención{' '}
          <span className="text-red-400/80">{formatCLP(retencion)}</span>
          {' '}→ líquido{' '}
          <span className="text-emerald-400 font-semibold">{formatCLP(liquidoTotal)}</span>.
        </p>
        {visiblesItems.length > 0 && (
          <p className="text-gray-500 text-xs">
            🔄 Los reembolsos están incluidos en la boleta y en el abono.
            El cliente los financia a través del pago del proyecto.
          </p>
        )}
      </div>

    </div>
  );
}
