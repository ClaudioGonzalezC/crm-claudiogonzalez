import { RETENTION_RATE, LIQUID_FACTOR } from "@/constants/financial";
import { formatCurrency } from "@/utils/formatCurrency";

interface CostoExtraItem {
  id: number;
  descripcion: string;
  monto_liquido: number;
  monto_bruto: number;
  visible_cliente?: number | boolean;
  fecha_registro?: string;
}

/**
 * TotalCalculator — Desglose financiero admin.
 *
 * MODELO UNIFICADO (todos los costos hacen gross-up):
 * ────────────────────────────────────────────────────
 *
 *   Base Boleta = Honorarios Brutos
 *               + SUM ocultos_bruto  (gross-up con Math.round)
 *               + SUM visibles_bruto (gross-up con Math.ceil)
 *   Retención   = Base Boleta × 15.25%
 *   Líquido     = Base Boleta − Retención
 *   Abono 50%   = Líquido × 0.5
 *
 * Ejemplo: $1M honorarios + $10k luz (oculto) + $10k dominio (visible)
 *   ocultosBruto  = round(10000/0.8475) = 11.799
 *   visiblesBruto = ceil(10000/0.8475)  = 11.800
 *   Base boleta   = 1.000.000 + 11.799 + 11.800 = 1.023.599
 *   Retención     = round(1.023.599 × 0.1525)   = 156.099
 *   Líquido       = 1.023.599 − 156.099         = 867.500
 *   Abono 50%     = round(867.500 × 0.5)        = 433.750
 *
 * Los reembolsos visibles se muestran separados como "gastos externos"
 * para que el admin entienda que son gestionados por el cliente,
 * pero SÍ forman parte de la boleta y del abono.
 */
interface TotalCalculatorProps {
  projectName: string;
  monto_bruto?: number;       // Honorarios brutos (de la BD)
  retencion_sii?: number;     // Retención de honorarios ya calculada
  monto_liquido?: number;     // Honorarios líquidos ya calculados
  costos_extra?: CostoExtraItem[];
  fecha_aceptacion?: string;  // Para segregar post-acuerdo
  totalPagado?: number;
  hours?: number;
  hourlyRate?: number;
}

export default function TotalCalculator({
  projectName,
  monto_bruto: propMontoBruto,
  retencion_sii: propRetencionSii,
  monto_liquido: propMontoLiquido,
  costos_extra = [],
  fecha_aceptacion,
  totalPagado = 0,
  hours = 0,
  hourlyRate = 0,
}: TotalCalculatorProps) {

  // ── 1. Honorarios ─────────────────────────────────────────────────────────
  const useDirectValues = (propMontoBruto ?? 0) > 0;

  const honorariosBruto = useDirectValues
    ? Math.round(propMontoBruto!)
    : Math.round(hours * hourlyRate);

  // ── 2. Segregar costos: originales vs post-acuerdo ────────────────────────
  const fechaCorte = fecha_aceptacion
    ? new Date(new Date(fecha_aceptacion).getTime() + 5 * 60 * 1000)
    : null;

  const esOriginal    = (c: CostoExtraItem) =>
    !fechaCorte || !c.fecha_registro ? true : new Date(c.fecha_registro) <= fechaCorte;
  const esPostAcuerdo = (c: CostoExtraItem) =>
    !!fechaCorte && !!c.fecha_registro && new Date(c.fecha_registro) > fechaCorte;

  const esOculto  = (c: CostoExtraItem) => c.visible_cliente === 0 || c.visible_cliente === false;
  const esVisible = (c: CostoExtraItem) => c.visible_cliente === 1 || c.visible_cliente === true;

  const ocultosOriginales  = costos_extra.filter(c => esOculto(c)  && esOriginal(c));
  const visiblesOriginales = costos_extra.filter(c => esVisible(c) && esOriginal(c));
  const postAcuerdoTodos   = costos_extra.filter(esPostAcuerdo);
  const postAcuerdoOcultos = postAcuerdoTodos.filter(esOculto);
  const postAcuerdoVisibles= postAcuerdoTodos.filter(esVisible);

  // ── 3. Gross-up de costos originales ─────────────────────────────────────
  // Ocultos: Math.round  → honorarios internalizados
  // Visibles: Math.ceil  → reembolsos del cliente (evita "peso faltante")
  // gross-up sobre el total neto (no ítem a ítem) para evitar error acumulativo
  const ocultosNetoTotal   = ocultosOriginales.reduce((s, c) => s + Math.round(c.monto_liquido || 0), 0);
  const visiblesNetoTotal  = visiblesOriginales.reduce((s, c) => s + Math.round(c.monto_liquido || 0), 0);

  const ocultosBrutoTotal  = ocultosNetoTotal  > 0 ? Math.round(ocultosNetoTotal  / LIQUID_FACTOR) : 0;
  const visiblesBrutoTotal = visiblesNetoTotal > 0 ? Math.ceil(visiblesNetoTotal  / LIQUID_FACTOR) : 0;

  // ── 4. Boleta original (costos del acuerdo) ───────────────────────────────
  const baseBoleta       = honorariosBruto + ocultosBrutoTotal + visiblesBrutoTotal;
  const retencionTotal   = Math.round(baseBoleta * RETENTION_RATE);
  const totalLiquidoBase = baseBoleta - retencionTotal;  // $867.500

  // Abono 50% congelado sobre el líquido base del acuerdo
  const abono50Requerido = Math.round(totalLiquidoBase * 0.5);  // $433.750

  // ── 5. Costos post-acuerdo (van al saldo final, no al abono) ─────────────
  const postNetoOcultos   = postAcuerdoOcultos.reduce((s, c) => s + Math.round(c.monto_liquido || 0), 0);
  const postNetoVisibles  = postAcuerdoVisibles.reduce((s, c) => s + Math.round(c.monto_liquido || 0), 0);
  const postBrutoOcultos  = postNetoOcultos  > 0 ? Math.round(postNetoOcultos  / LIQUID_FACTOR) : 0;
  const postBrutoVisibles = postNetoVisibles > 0 ? Math.ceil(postNetoVisibles  / LIQUID_FACTOR) : 0;
  const postBrutoTotal    = postBrutoOcultos + postBrutoVisibles;
  const postRetencion     = Math.round(postBrutoTotal * RETENTION_RATE);
  const liquidoPost       = postBrutoTotal - postRetencion;

  // ── 6. Totales finales ────────────────────────────────────────────────────
  const totalLiquidoFinal = totalLiquidoBase + liquidoPost;

  // ── 7. Estado del abono (declarados una sola vez, justo antes del return) ─
  const totalPagadoR   = Math.round(totalPagado);
  const abonoAlcanzado = totalPagadoR >= abono50Requerido;
  const saldoFinal     = Math.max(totalLiquidoFinal - totalPagadoR, 0);

  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-slate-900/30 backdrop-blur border border-blue-500/20 rounded-2xl p-8 space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xl font-bold text-white">Cálculo Total Actualizado</h3>
        {projectName && <p className="text-gray-400 text-sm mt-1">Proyecto: {projectName}</p>}
      </div>

      {/* ══ BLOQUE 1: BOLETA (flujo vertical) ════════════════════════════════ */}
      <div className="rounded-xl border border-blue-500/20 overflow-hidden">
        <div className="px-5 py-3 bg-blue-500/10 border-b border-blue-500/20">
          <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">
            💼 Tu Pago — Base de Boleta (SII)
          </p>
        </div>
        <div className="p-5 space-y-2.5">

          {/* Honorarios brutos */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-300 text-sm">Honorarios Brutos</p>
              {!useDirectValues && (
                <p className="text-gray-500 text-xs mt-0.5">{hours}h × {formatCurrency(hourlyRate)}</p>
              )}
            </div>
            <p className="text-blue-300 font-semibold">{formatCurrency(honorariosBruto)}</p>
          </div>

          {/* Costos OCULTOS originales: sangría, gross-up round */}
          {ocultosOriginales.length > 0 && (
            <div className="space-y-1.5 pl-4 border-l-2 border-slate-600/40">
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Costos ocultos — internalizados
              </p>
              {ocultosOriginales.map((c) => (
                <div key={c.id} className="flex justify-between items-center">
                  <p className="text-gray-400 text-xs">
                    🔒 {c.descripcion}
                    <span className="text-gray-600 ml-1">
                      ({formatCurrency(Math.round(c.monto_liquido || 0))} neto / 0.8475)
                    </span>
                  </p>
                  <p className="text-gray-300 text-xs font-semibold">
                    + {formatCurrency(Math.round(c.monto_bruto || 0))}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Costos VISIBLES originales: sangría diferente, gross-up ceil */}
          {visiblesOriginales.length > 0 && (
            <div className="space-y-1.5 pl-4 border-l-2 border-cyan-600/30">
              <p className="text-cyan-500/70 text-xs uppercase tracking-wider">
                Reembolsos del cliente — incluidos en boleta
              </p>
              {visiblesOriginales.map((c) => (
                <div key={c.id} className="flex justify-between items-center">
                  <p className="text-gray-400 text-xs">
                    🔄 {c.descripcion}
                    <span className="text-gray-600 ml-1">
                      ({formatCurrency(Math.round(c.monto_liquido || 0))} neto / 0.8475↑)
                    </span>
                  </p>
                  <p className="text-cyan-300/80 text-xs font-semibold">
                    + {formatCurrency(Math.ceil((c.monto_liquido || 0) / (1 - RETENTION_RATE)))}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Base total boleta (solo si hay costos) */}
          {(ocultosOriginales.length > 0 || visiblesOriginales.length > 0) && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-700/30">
              <p className="text-gray-400 text-xs uppercase tracking-wider">Base total a boletear</p>
              <p className="text-blue-200 font-semibold">{formatCurrency(baseBoleta)}</p>
            </div>
          )}

          {/* Retención SII */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">− Retención SII (15.25%)</p>
              {(ocultosOriginales.length > 0 || visiblesOriginales.length > 0) && (
                <p className="text-gray-600 text-xs mt-0.5">sobre {formatCurrency(baseBoleta)}</p>
              )}
            </div>
            <p className="text-red-400 font-semibold">− {formatCurrency(retencionTotal)}</p>
          </div>

          {/* Total líquido — resultado principal */}
          <div className="flex justify-between items-center pt-2 border-t-2 border-slate-600/40">
            <div>
              <p className="text-white font-bold text-sm">= Total Líquido</p>
              <p className="text-gray-500 text-xs mt-0.5">Lo que recibirás en tu cuenta</p>
            </div>
            <p className="text-emerald-400 font-bold text-2xl">{formatCurrency(totalLiquidoBase)}</p>
          </div>
        </div>
      </div>

      {/* ══ BLOQUE 2: ABONO 50% ══════════════════════════════════════════════ */}
      <div className="rounded-xl border border-amber-500/20 overflow-hidden">
        <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
          <div>
            <p className="text-amber-300 text-xs font-bold uppercase tracking-widest">
              Abono Inicial — 50%
            </p>
            <p className="text-amber-400/60 text-xs mt-0.5">
              {formatCurrency(totalLiquidoBase)} × 50% = {formatCurrency(abono50Requerido)}
            </p>
          </div>
          {abonoAlcanzado ? (
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
              ✓ Confirmado
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full border border-amber-500/30">
              ⏳ Pendiente
            </span>
          )}
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Abono requerido</p>
            <p className="text-amber-300 font-bold text-xl">{formatCurrency(abono50Requerido)}</p>
          </div>
          {totalPagadoR > 0 && (
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Pagado a la fecha</p>
              <p className={`font-semibold ${abonoAlcanzado ? 'text-emerald-400' : 'text-blue-400'}`}>
                {formatCurrency(totalPagadoR)}
              </p>
            </div>
          )}
          {abono50Requerido > 0 && (
            <>
              <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    abonoAlcanzado
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : 'bg-gradient-to-r from-amber-500 to-orange-400'
                  }`}
                  style={{ width: `${Math.min((totalPagadoR / abono50Requerido) * 100, 100)}%` }}
                />
              </div>
              <p className={`text-xs text-right ${abonoAlcanzado ? 'text-emerald-400' : 'text-amber-400/80'}`}>
                {abonoAlcanzado
                  ? '✓ Abono completo'
                  : `Falta ${formatCurrency(Math.max(abono50Requerido - totalPagadoR, 0))}`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ══ BLOQUE 3: COSTOS POST-ACUERDO (saldo final) ══════════════════════ */}
      {postAcuerdoTodos.length > 0 && (
        <div className="rounded-xl border border-orange-500/20 overflow-hidden">
          <div className="px-5 py-3 bg-orange-500/10 border-b border-orange-500/20">
            <p className="text-orange-300 text-xs font-bold uppercase tracking-widest">
              Costos Post-Acuerdo — Saldo Final
            </p>
            <p className="text-orange-400/60 text-xs mt-0.5">
              El abono ({formatCurrency(abono50Requerido)}) queda fijo. Se cobran al cierre.
            </p>
          </div>
          <div className="p-5 space-y-2">
            {postAcuerdoTodos.map((c) => (
              <div key={c.id} className="flex justify-between items-center pl-4 border-l-2 border-orange-500/30">
                <div>
                  <p className="text-gray-300 text-sm">{c.descripcion}</p>
                  <p className="text-gray-500 text-xs">
                    {esVisible(c) ? '🔄 Reembolso' : '🔒 Internalizado'}
                  </p>
                </div>
                <p className="text-orange-400 font-semibold text-sm">
                  + {formatCurrency(Math.round(c.monto_liquido || 0))} líq.
                </p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-slate-700/40">
              <p className="text-gray-300 font-semibold text-sm">Líquido adicional al cierre</p>
              <p className="text-orange-400 font-bold">+ {formatCurrency(liquidoPost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOTAL LÍQUIDO FINAL (solo si hay post-acuerdo) ═══════════════════ */}
      {postAcuerdoTodos.length > 0 && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
          <p className="text-emerald-400/70 text-xs font-medium mb-1 uppercase tracking-wider">
            Total Líquido Final a Recibir
          </p>
          <p className="text-4xl font-bold text-emerald-400">{formatCurrency(totalLiquidoFinal)}</p>
          {totalPagadoR > 0 && saldoFinal > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-500/20 flex justify-between items-center">
              <p className="text-gray-400 text-sm">Saldo pendiente al cierre</p>
              <p className="text-orange-400 font-bold text-lg">{formatCurrency(saldoFinal)}</p>
            </div>
          )}
          {totalPagadoR > 0 && saldoFinal === 0 && (
            <p className="text-emerald-400 text-sm font-semibold mt-2">✓ Liquidado completamente</p>
          )}
        </div>
      )}

      {/* ══ NOTA FINAL ═══════════════════════════════════════════════════════ */}
      <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/30 space-y-1.5">
        <p className="text-gray-400 text-xs">
          💡 Boleta:{' '}
          <span className="text-gray-300 font-semibold">{formatCurrency(baseBoleta)}</span>
          {' '}brutos → retención{' '}
          <span className="text-red-400/80">{formatCurrency(retencionTotal)}</span>
          {' '}→ líquido{' '}
          <span className="text-emerald-400 font-semibold">{formatCurrency(totalLiquidoBase)}</span>.
        </p>
        {visiblesOriginales.length > 0 && (
          <p className="text-gray-500 text-xs">
            🔄 Los reembolsos visibles están incluidos en la boleta (gross-up con ↑ para evitar pérdida de centavos).
          </p>
        )}
      </div>

    </div>
  );
}
