import { Link } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import { useState, useEffect } from "react";

type ProjectStatus = string;

interface RecentProjectCardProps {
  id: number;
  nombre: string;
  estado: ProjectStatus;
  monto: number;
  isPlaceholder?: boolean;
  montoBruto?: number;
  montoLiquido?: number;
  totalPagado?: number;
  fechaAceptacion?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Cotización: "bg-blue-500/20 text-blue-400",
  "Desarrollo Inicial": "bg-purple-500/20 text-purple-400",
  "En Desarrollo": "bg-purple-500/20 text-purple-400",
  Revisiones: "bg-orange-500/20 text-orange-400",
  Finalizado: "bg-emerald-500/20 text-emerald-400",
  Cobrado: "bg-green-500/20 text-green-400",
};

const getStatusColor = (status: ProjectStatus): string => {
  if (STATUS_COLORS[status]) return STATUS_COLORS[status];
  if (status.includes("Revisión")) return STATUS_COLORS["En Desarrollo"];
  return STATUS_COLORS["Revisiones"];
};

// Hook: returns live countdown "HH:MM" while window is open, null otherwise
function useUrgencyCountdown(
  fechaAceptacion: string | undefined,
  totalPagado: number,
  montoBruto: number,
  estado: ProjectStatus
): string | null {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    const closedStates = ["Cobrado", "Finalizado"];
    if (closedStates.includes(estado) || !fechaAceptacion || montoBruto <= 0) {
      setDisplay(null);
      return;
    }
    // Badge solo cuando aún no ha pagado el 50%
    if (totalPagado >= montoBruto * 0.5) {
      setDisplay(null);
      return;
    }

    const deadline = new Date(fechaAceptacion).getTime() + 48 * 60 * 60 * 1000;

    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setDisplay(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setDisplay(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    };

    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [fechaAceptacion, totalPagado, montoBruto, estado]);

  return display;
}

export default function RecentProjectCard({
  id,
  nombre,
  estado,
  monto,
  isPlaceholder = false,
  montoBruto = 0,
  montoLiquido = 0,
  totalPagado = 0,
  fechaAceptacion,
}: RecentProjectCardProps) {
  const urgencyCountdown = useUrgencyCountdown(fechaAceptacion, totalPagado, montoBruto, estado);

  const fmt = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  if (isPlaceholder) {
    return (
      <div className="bg-slate-800/30 border-2 border-dashed border-slate-600/50 rounded-xl p-4 flex items-center justify-center min-h-24 cursor-default hover:border-slate-500/50 transition">
        <p className="text-gray-500 text-sm text-center">Sin proyecto</p>
      </div>
    );
  }

  return (
    <Link
      to={`/proyecto/${id}`}
      className="bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 hover:border-blue-500/50 rounded-xl p-4 transition group cursor-pointer flex flex-col h-full hover:shadow-lg hover:shadow-blue-500/20 relative"
    >
      {/* ⏳ Badge de urgencia 48h — solo cuando aplica */}
      {urgencyCountdown && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
          <Clock className="w-2.5 h-2.5" />
          ⏳ {urgencyCountdown}
        </div>
      )}

      {/* Project Name */}
      <h4 className="text-sm font-semibold text-white mb-3 line-clamp-2 group-hover:text-blue-400 transition pr-2">
        {nombre}
      </h4>

      {/* Status Badge & Amount */}
      <div className="space-y-3 mt-auto pt-3 border-t border-slate-700/30">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${getStatusColor(estado)}`}
          >
            {estado}
          </span>
          <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-blue-400 transition" />
        </div>

        {/* Monto Display */}
        <div className="space-y-2">
          {montoBruto > 0 && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-gray-400">Total:</span>
              <span className="text-xs font-semibold text-orange-400">
                {fmt(montoBruto)}
              </span>
            </div>
          )}
          {montoLiquido > 0 && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-gray-400">Líquido:</span>
              <span className="text-xs font-semibold text-emerald-400">
                {fmt(montoLiquido)}
              </span>
            </div>
          )}
          {montoBruto === 0 && montoLiquido === 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-emerald-400">
                {fmt(monto)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
