import { RotateCcw } from "lucide-react";

interface RevisionCounterReadOnlyProps {
  included: number;
  used: number;
}

export default function RevisionCounterReadOnly({
  included = 0,
  used = 0,
}: RevisionCounterReadOnlyProps) {
  // Defensive validation - convert to safe numbers
  const safeIncluded = Math.max(parseInt(String(included)) || 0, 0);
  const safeUsed = Math.max(parseInt(String(used)) || 0, 0);

  const remaining = Math.max(safeIncluded - safeUsed, 0);
  const isOverLimit = safeUsed > safeIncluded;
  const percentageUsed = safeIncluded > 0 ? (safeUsed / safeIncluded) * 100 : 0;

  console.log('📝 RevisionCounterReadOnly Debug:', {
    included: safeIncluded,
    used: safeUsed,
    remaining,
    isOverLimit,
    percentageUsed,
  });

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <RotateCcw className="w-6 h-6 text-orange-400" />
        <div>
          <h3 className="text-2xl font-bold text-white">Revisiones Incluidas</h3>
          <p className="text-gray-400 text-sm mt-1">
            {safeUsed} de {safeIncluded} revisiones utilizadas
          </p>
        </div>
      </div>

      {/* Revision Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Included */}
        <div className="bg-slate-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Total Incluidas</p>
          <p className="text-3xl font-bold text-blue-400">{safeIncluded}</p>
        </div>

        {/* Used */}
        <div className="bg-slate-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Ya Utilizadas</p>
          <p
            className={`text-3xl font-bold ${
              isOverLimit ? "text-red-400" : "text-orange-400"
            }`}
          >
            {safeUsed}
          </p>
        </div>

        {/* Remaining */}
        <div className="bg-slate-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Disponibles</p>
          <p
            className={`text-3xl font-bold ${
              remaining === 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {remaining}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative w-full h-3 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className={`h-full transition-all duration-300 ${
              isOverLimit
                ? "bg-gradient-to-r from-red-600 to-red-500"
                : percentageUsed > 75
                  ? "bg-gradient-to-r from-orange-600 to-orange-500"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-500"
            }`}
            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>{Math.round(percentageUsed)}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Status Message */}
      {isOverLimit && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">
            ⚠️ Se han excedido las revisiones incluidas. Las revisiones adicionales podrían incurrir en costos extra.
          </p>
        </div>
      )}

      {remaining === 0 && !isOverLimit && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
          <p className="text-orange-400 text-sm">
            ⚠️ Se han utilizado todas las revisiones incluidas.
          </p>
        </div>
      )}

      {remaining > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <p className="text-emerald-400 text-sm">
            ✓ Aún hay {remaining} {remaining === 1 ? "revisión" : "revisiones"} disponibles.
          </p>
        </div>
      )}
    </div>
  );
}
