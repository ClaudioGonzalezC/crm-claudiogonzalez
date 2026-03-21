import { useState } from "react";
import axios from "axios";
import { Plus, Minus, Loader2 } from "lucide-react";

interface RevisionCounterProps {
  projectId: number;
  included: number;
  used: number;
  projectStatus?: string;   // Estado actual del proyecto para sincronización
  onUpdate: (used: number) => void;
}

export default function RevisionCounter({
  projectId,
  included,
  used,
  projectStatus = "",
  onUpdate,
}: RevisionCounterProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const remaining = Math.max(included - used, 0);
  const isExceeded = used > included;

  // ── REGLA 2: Sincronización con estado del proyecto ──────────────────────
  // El estado "Revisión N" es el ACTIVADOR → el contador puede subir a N una vez
  // que el estado ya refleja esa revisión.
  // Flujo:  Admin selecciona "Revisión 1" → botón + habilitado → used=1
  //         Admin selecciona "Revisión 2" → botón + habilitado → used=2
  const currentRevisionInStatus = (() => {
    const match = projectStatus.match(/^Revisión (\d+)$/);
    return match ? parseInt(match[1]) : 0;
  })();

  const canIncrement = (() => {
    if (used >= included) return false;
    const nextUsed = used + 1;
    // Primera revisión: estado "Revisión 1" O todavía en "Desarrollo Inicial"
    if (nextUsed === 1) {
      return currentRevisionInStatus >= 1 || projectStatus === "Desarrollo Inicial";
    }
    // Revisiones siguientes: el estado debe ser exactamente "Revisión nextUsed"
    return currentRevisionInStatus === nextUsed;
  })();

  const incrementBlockReason = !canIncrement && used < included
    ? used === 0
      ? `Primero cambia el estado del proyecto a "Revisión 1" para activar el conteo`
      : `Primero cambia el estado del proyecto a "Revisión ${used + 1}" para registrar esta revisión`
    : "";

  const handleUpdateRevisions = async (newUsed: number) => {
    if (newUsed < 0) return;

    setLoading(true);
    setError("");

    try {
      await axios.post(
        "https://crm.claudiogonzalez.dev/api/actualizar_revisiones_proyecto.php",
        {
          id: projectId,
          revisiones_usadas: newUsed,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      onUpdate(newUsed);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al actualizar revisiones"
          : "Error al actualizar revisiones"
      );
    } finally {
      setLoading(false);
    }
  };

  const percentage = Math.min((used / included) * 100, 100);

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8">
      <h3 className="text-xl font-bold text-white mb-6">Control de Revisiones</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Counter Display */}
      <div className="space-y-6">
        {/* Visual Progress Bar */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-gray-400 text-sm mb-1">Revisiones Usadas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-white">{used}</p>
                <p className="text-xl text-gray-500">de {included}</p>
              </div>
            </div>
            {!isExceeded && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Disponibles</p>
                <p className="text-2xl font-bold text-emerald-400">{remaining}</p>
              </div>
            )}
            {isExceeded && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Excedidas por</p>
                <p className="text-2xl font-bold text-red-400">
                  +{used - included}
                </p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden border border-slate-700/30">
            <div
              className={`h-full transition-all duration-300 ${
                isExceeded
                  ? "bg-gradient-to-r from-orange-500 to-red-500"
                  : "bg-gradient-to-r from-blue-500 to-emerald-500"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {isExceeded
              ? "⚠️ Se han excedido las revisiones incluidas"
              : `${Math.round(percentage)}% del plan de revisiones`}
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleUpdateRevisions(Math.max(used - 1, 0))}
            disabled={loading || used === 0}
            className="flex-1 px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 border border-slate-600/50 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Minus className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">Menos</span>
          </button>

          <div className="px-6 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg flex items-center justify-center min-h-[44px]">
            <p className="text-2xl font-bold text-white">{used}</p>
          </div>

          <button
            onClick={() => handleUpdateRevisions(used + 1)}
            disabled={loading || !canIncrement}
            title={incrementBlockReason}
            className="flex-1 px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 border border-slate-600/50 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">Más</span>
          </button>
        </div>

        {/* Status Message */}
        <div
          className={`p-4 rounded-lg text-sm ${
            isExceeded
              ? "bg-red-500/10 border border-red-500/30 text-red-400"
              : remaining === 0
              ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
              : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
          }`}
        >
          {isExceeded
            ? `⚠️ Se han usado ${used - included} revisiones adicionales. Considera cobrar por revisiones extra.`
            : remaining === 0
            ? "⚠️ Se han consumido todas las revisiones incluidas."
            : `✓ Faltan ${remaining} revisión${remaining === 1 ? "" : "es"} disponibles.`}
        </div>

        {/* Regla 2: Aviso de sincronización */}
        {incrementBlockReason && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs">
            🔒 {incrementBlockReason}
          </div>
        )}
      </div>
    </div>
  );
}
