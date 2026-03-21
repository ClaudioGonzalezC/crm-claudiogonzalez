import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ProfitabilityCalculatorProps {
  hourlyRate: number;
  minimumHourlyRate: number;
  hours: number;
}

export default function ProfitabilityCalculator({
  hourlyRate,
  minimumHourlyRate,
  hours,
}: ProfitabilityCalculatorProps) {
  const isProfitable = hourlyRate >= minimumHourlyRate;
  const difference = hourlyRate - minimumHourlyRate;
  const percentageAboveMinimum = Math.round(
    ((hourlyRate - minimumHourlyRate) / minimumHourlyRate) * 100
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">
          Análisis de Rentabilidad
        </h3>
      </div>

      {/* Traffic Light Indicator */}
      <div
        className={`p-6 rounded-xl border-2 flex items-start gap-4 ${
          isProfitable
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-orange-500/10 border-orange-500/30"
        }`}
      >
        <div className="flex-shrink-0 pt-0.5">
          {isProfitable ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-orange-400" />
          )}
        </div>
        <div className="flex-1">
          <p
            className={`font-semibold text-lg ${
              isProfitable
                ? "text-emerald-400"
                : "text-orange-400"
            }`}
          >
            {isProfitable
              ? "✅ Proyecto Rentable"
              : "⚠️ Proyecto por debajo de meta de rentabilidad"}
          </p>
          <p className={`text-sm mt-2 ${
            isProfitable
              ? "text-emerald-300/80"
              : "text-orange-300/80"
          }`}>
            {isProfitable ? (
              <>
                Tu valor hora es{" "}
                <span className="font-semibold">
                  {percentageAboveMinimum}% superior
                </span>{" "}
                a tu meta mínima
              </>
            ) : (
              <>
                Tu valor hora está{" "}
                <span className="font-semibold">
                  {Math.abs(percentageAboveMinimum)}% por debajo
                </span>{" "}
                de tu meta mínima
              </>
            )}
          </p>
        </div>
      </div>

      {/* Rate Comparison */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Tu Valor Hora
          </p>
          <p className="text-2xl font-bold text-blue-400">
            {formatCurrency(hourlyRate)}
          </p>
        </div>
        <div className="flex items-center justify-center">
          <div className="h-px w-full bg-slate-700/50"></div>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
            Meta Mínima
          </p>
          <p className="text-2xl font-bold text-amber-400">
            {formatCurrency(minimumHourlyRate)}
          </p>
        </div>
      </div>

      {/* Difference */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
        <p className="text-gray-400 text-sm mb-1">Diferencia</p>
        <p
          className={`text-xl font-bold ${
            isProfitable ? "text-emerald-400" : "text-orange-400"
          }`}
        >
          {isProfitable ? "+" : ""}
          {formatCurrency(difference)}
        </p>
      </div>

      {/* Breakdown by Hours */}
      {hours > 0 && (
        <div className="pt-4 border-t border-slate-700/50">
          <p className="text-gray-400 text-sm mb-4">
            Por <span className="font-semibold text-gray-300">{hours} horas</span>:
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal (horas × valor)</span>
              <span className="text-gray-100 font-semibold">
                {formatCurrency(hourlyRate * hours)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
