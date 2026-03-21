import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, CheckCircle2 } from "lucide-react";

type ProjectStatus = string; // Now flexible to support dynamic revision statuses

const STATUS_COLORS: Record<string, string> = {
  Cotización: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Desarrollo Inicial": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Finalizado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Cobrado: "bg-green-500/20 text-green-400 border-green-500/30",
};

// Default color for revision states
const DEFAULT_REVISION_COLOR = "bg-orange-500/20 text-orange-400 border-orange-500/30";

interface ProjectStatusProps {
  projectId: number;
  currentStatus: ProjectStatus;
  totalPaid?: number;
  totalContract?: number;
  totalRevisions?: number;   // Revisiones incluidas en el contrato
  revisionsUsed?: number;    // Revisiones ya usadas (para Regla 2)
  onStatusChange: (newStatus: ProjectStatus) => void;
  onStatusChangeSuccess?: () => void;
}

export default function ProjectStatusComponent({
  projectId,
  currentStatus,
  totalPaid = 0,
  totalContract = 0,
  totalRevisions = 0,
  revisionsUsed = 0,
  onStatusChange,
  onStatusChangeSuccess,
}: ProjectStatusProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [localStatus, setLocalStatus] = useState(currentStatus);
  const [validationWarning, setValidationWarning] = useState("");

  const totalPaidRounded = Math.round(totalPaid);
  const hasPendingBalance = totalPaidRounded < totalContract;
  const hasMinimumPayment = totalContract > 0
    ? totalPaidRounded >= Math.round(totalContract * 0.5)
    : totalPaidRounded > 0;

  // ── REGLA 1: Bloqueo de Cotización ──────────────────────────────────────
  // Ningún estado distinto a "Cotización" puede activarse si no hay anticipo >= 50%
  const isBlockedByCotizacion = (status: ProjectStatus): boolean => {
    if (localStatus !== "Cotización") return false;      // Solo aplica desde Cotización
    if (status === "Cotización") return false;           // Puede quedarse en Cotización
    return !hasMinimumPayment;                           // Bloquear si no hay 50%
  };

  // ── REGLA 2: Sincronización de Revisiones ───────────────────────────────
  // El estado "Revisión N" es el ACTIVADOR — se selecciona ANTES de subir el contador.
  // Condición: se puede ir a "Revisión N" si revisionsUsed >= N-1
  //   used=0 → "Revisión 1" libre  (0 >= 0 ✓)
  //   used=1 → "Revisión 2" libre  (1 >= 1 ✓)
  //   used=0 → "Revisión 2" bloqueada (0 >= 1 ✗)
  // Caso especial: "Revisión 1" desde "Desarrollo Inicial" con pago >= 50% siempre libre.
  const isBlockedByRevisionSync = (status: ProjectStatus): boolean => {
    const match = status.match(/^Revisión (\d+)$/);
    if (!match) return false;
    const n = parseInt(match[1]);
    if (n === 1 && localStatus === "Desarrollo Inicial" && hasMinimumPayment) return false;
    return revisionsUsed < n - 1;
  };

  const getBlockReason = (status: ProjectStatus): string => {
    if (isBlockedByCotizacion(status)) {
      const needed = Math.round(totalContract * 0.5);
      const falta = needed - totalPaidRounded;
      return `Requiere pago inicial del 50% para iniciar. Falta $${falta.toLocaleString("es-CL")}`;
    }
    if (isBlockedByRevisionSync(status)) {
      const match = status.match(/^Revisión (\d+)$/)!;
      const n = parseInt(match[1]);
      return `Para activar Revisión ${n}, primero completa la Revisión ${n - 1} en el contador`;
    }
    if (status === "Cobrado" && hasPendingBalance) {
      return "No puedes marcar como Cobrado con saldo pendiente";
    }
    return "";
  };

  // Update local status when prop changes
  useEffect(() => {
    setLocalStatus(currentStatus);
  }, [currentStatus]);

  // Generate statuses dynamically based on totalRevisions
  const generateStatuses = (): ProjectStatus[] => {
    const statuses: ProjectStatus[] = [
      "Cotización",
      "Desarrollo Inicial",
    ];

    // Add revision states dynamically
    if (totalRevisions && totalRevisions > 0) {
      for (let i = 1; i <= totalRevisions; i++) {
        statuses.push(`Revisión ${i}`);
      }
    }

    // Add final states
    statuses.push("Finalizado", "Cobrado");

    return statuses;
  };

  const statuses = generateStatuses();

  // Helper function to get color for any status (including dynamic revision states)
  const getStatusColor = (status: ProjectStatus): string => {
    if (STATUS_COLORS[status]) {
      return STATUS_COLORS[status];
    }
    // For revision states and any unknown states, use default revision color
    return DEFAULT_REVISION_COLOR;
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (newStatus === localStatus) return;

    // ── REGLA 1: Bloqueo de Cotización ──────────────────────────────────
    if (isBlockedByCotizacion(newStatus)) {
      setError(getBlockReason(newStatus));
      return;
    }

    // ── REGLA 2: Sincronización de Revisiones ───────────────────────────
    if (isBlockedByRevisionSync(newStatus)) {
      setError(getBlockReason(newStatus));
      return;
    }

    // Validación: No se puede marcar como "Cobrado" con saldo pendiente
    if (newStatus === "Cobrado" && hasPendingBalance) {
      setError("No puedes marcar como Cobrado un proyecto con saldo pendiente");
      return;
    }

    // Advertencia: "Finalizado" con saldo pendiente
    if (newStatus === "Finalizado" && hasPendingBalance) {
      setValidationWarning("Nota: El proyecto está finalizado pero aún tiene saldo pendiente de cobro");
    } else {
      setValidationWarning("");
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/actualizar_estado_proyecto.php",
        {
          id: projectId,
          estado: newStatus,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Check if response indicates success
      if (response.status === 200 || response.status === 201) {
        setLocalStatus(newStatus);
        onStatusChange(newStatus);
        setSuccess(true);

        // Trigger parent refresh to get fresh data from DB
        if (onStatusChangeSuccess) {
          console.log("Disparando refresh del componente padre");
          onStatusChangeSuccess();
        }

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        throw new Error("La respuesta del servidor no fue exitosa");
      }
    } catch (err) {
      let errorMessage = "Error al actualizar estado";

      if (axios.isAxiosError(err)) {
        console.error("❌ Error al actualizar estado:", {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });

        // Handle 403 Forbidden - extract message from server
        if (err.response?.status === 403) {
          // Try different message paths from backend response
          const serverMessage =
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.response?.data?.detail ||
            "No puedes cambiar el estado del proyecto. Verifica los requisitos de pago.";
          errorMessage = serverMessage;
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else {
          errorMessage = `Error ${err.response?.status || "desconocido"} al actualizar estado`;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8">
      <h3 className="text-xl font-bold text-white mb-4">Estado del Proyecto</h3>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border-2 border-red-500/50 rounded-lg flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-red-400 font-semibold text-sm md:text-base">Error al cambiar estado</p>
            <p className="text-red-300/90 text-xs md:text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Estado actualizado correctamente
        </div>
      )}

      {validationWarning && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-400 text-sm">
          {validationWarning}
        </div>
      )}

      {/* Info about payment status */}
      {totalContract > 0 && (
        <div className="mb-4 p-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-gray-300 text-xs">
          <p className="font-semibold mb-1">Estado de Pago</p>
          <p>Total Contrato: <span className="text-white font-semibold">${totalContract.toLocaleString("es-CL")}</span></p>
          <p>Total Pagado: <span className={`font-semibold ${totalPaidRounded >= totalContract ? "text-emerald-400" : "text-orange-400"}`}>
            ${totalPaidRounded.toLocaleString("es-CL")}
          </span></p>
          {hasPendingBalance && (
            <p className="mt-2 text-orange-400">Saldo Pendiente: <span className="font-semibold">${(totalContract - totalPaidRounded).toLocaleString("es-CL")}</span></p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {statuses.map((status) => {
          const blockedByCotizacion  = isBlockedByCotizacion(status);
          const blockedByRevision    = isBlockedByRevisionSync(status);
          const blockedByCobrado     = status === "Cobrado" && hasPendingBalance;
          const isBlocked            = blockedByCotizacion || blockedByRevision || blockedByCobrado;
          const blockReason          = getBlockReason(status);

          return (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={loading || isBlocked}
              title={blockReason}
              className={`px-2 py-2 rounded-lg border font-semibold text-xs md:text-sm transition ${
                status === localStatus
                  ? `${getStatusColor(status)} ring-2 ring-offset-2 ring-offset-slate-900`
                  : isBlocked
                  ? "bg-slate-800/30 border-slate-600/30 text-gray-500 cursor-not-allowed"
                  : "bg-slate-800/50 border-slate-600/50 text-gray-400 hover:border-slate-500/50"
              } disabled:opacity-50 flex flex-col items-center justify-center gap-1 min-h-[44px]`}
            >
              {loading && status === localStatus && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              <span className="line-clamp-2">{status}</span>
              {/* Ícono de candado para estados bloqueados */}
              {isBlocked && status !== localStatus && (
                <span className="text-gray-600 text-[10px] leading-tight">
                  {blockedByCotizacion ? "🔒 50% requerido" : blockedByRevision ? "🔒 Revisión anterior pendiente" : "🔒 Saldo pendiente"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
