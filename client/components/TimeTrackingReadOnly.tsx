import { Clock } from "lucide-react";
import { safeFormatDate } from "@/utils/dateFormatter";

export interface TimeEntry {
  id: number;
  proyecto_id: number;
  horas: number;
  descripcion: string;
  fecha: string;
}

interface TimeTrackingReadOnlyProps {
  estimatedHours: number;
  timeEntries: TimeEntry[];
}

export default function TimeTrackingReadOnly({
  estimatedHours = 0,
  timeEntries = [],
}: TimeTrackingReadOnlyProps) {
  // Defensive sum - handle null/undefined/empty arrays
  const totalRealHours = (Array.isArray(timeEntries) ? timeEntries : []).reduce(
    (sum, entry) => sum + (parseFloat(String(entry?.horas || 0)) || 0),
    0
  );

  const safeEstimatedHours = Math.max(parseFloat(String(estimatedHours)) || 0, 0);
  const hoursRemaining = Math.max(safeEstimatedHours - totalRealHours, 0);
  const progressPercentage = safeEstimatedHours > 0 ? Math.min((totalRealHours / safeEstimatedHours) * 100, 100) : 0;
  const isOverBudget = totalRealHours > safeEstimatedHours;

  console.log('⏱️ TimeTrackingReadOnly Debug:', {
    estimatedHours: safeEstimatedHours,
    totalRealHours,
    hoursRemaining,
    progressPercentage,
  });

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-6 h-6 text-blue-400" />
        <h3 className="text-2xl font-bold text-white">Seguimiento de Tiempo</h3>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <p className="text-gray-400 text-sm">Horas Reales vs Estimadas</p>
          <p className="text-2xl font-bold text-white">
            {totalRealHours.toFixed(1)} <span className="text-sm text-gray-400">/ {safeEstimatedHours}</span>
          </p>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className={`h-full transition-all duration-300 ${
              isOverBudget
                ? "bg-gradient-to-r from-red-600 to-red-500"
                : "bg-gradient-to-r from-emerald-600 to-emerald-500"
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Status Text */}
        <div className="flex justify-between items-center pt-2">
          <p className="text-gray-500 text-xs">
            {isOverBudget
              ? `⚠️ ${(totalRealHours - estimatedHours).toFixed(1)} horas sobre presupuesto`
              : `✓ ${hoursRemaining.toFixed(1)} horas restantes`}
          </p>
          <p className={`text-sm font-semibold ${isOverBudget ? "text-red-400" : "text-emerald-400"}`}>
            {progressPercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Time Entries History - Desktop Table */}
      {timeEntries.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-4">Registro de Trabajo</h4>

          {/* Desktop Table */}
          <div className="hidden md:block space-y-2 max-h-96 overflow-y-auto">
            {[...timeEntries]
              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
              .map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 flex items-start justify-between hover:bg-slate-800/50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white">{entry.horas.toFixed(1)}h</p>
                      <p className="text-gray-400 text-xs">{safeFormatDate(entry.fecha)}</p>
                    </div>
                    <p className="text-gray-400 text-sm">{entry.descripcion}</p>
                  </div>
                </div>
              ))}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3 max-h-96 overflow-y-auto">
            {[...timeEntries]
              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
              .map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-gray-400 text-xs">{safeFormatDate(entry.fecha)}</p>
                    <p className="text-lg font-bold text-blue-400">{entry.horas.toFixed(1)}h</p>
                  </div>
                  <p className="text-gray-300 text-sm">{entry.descripcion}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {timeEntries.length === 0 && (
        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">No hay registros de tiempo aún</p>
        </div>
      )}
    </div>
  );
}
