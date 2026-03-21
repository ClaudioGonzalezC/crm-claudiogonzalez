import { Link } from "react-router-dom";
import { AlertTriangle, Globe, Server, CheckCircle2 } from "lucide-react";

export interface ExpirationProject {
  id: number;
  proyecto: string;
  cliente_nombre: string;
  dominio_nombre?: string | null;
  dominio_provider?: string | null;
  dominio_vencimiento?: string | null;
  hosting_provider?: string | null;
  hosting_plan?: string | null;
  hosting_vencimiento?: string | null;
}

interface UpcomingExpirationsProps {
  projects: ExpirationProject[];
  /** Días de anticipación para mostrar (default 90) */
  warningDays?: number;
}

interface ExpirationRow {
  projectId: number;
  projectName: string;
  clientName: string;
  type: "dominio" | "hosting";
  name: string;
  provider: string;
  daysLeft: number;
  dateStr: string;
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function formatDateCL(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function urgencyStyle(days: number) {
  if (days < 0)   return { row: "bg-red-950/30 border-red-600/30",   badge: "bg-red-500/20 text-red-300 border-red-500/30",    label: "VENCIDO",   icon: "🔴" };
  if (days <= 14)  return { row: "bg-red-900/20 border-red-500/20",   badge: "bg-red-500/20 text-red-400 border-red-500/30",    label: `${days}d`,  icon: "🔴" };
  if (days <= 30)  return { row: "bg-orange-900/10 border-orange-500/20", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: `${days}d`, icon: "🟠" };
  if (days <= 60)  return { row: "bg-amber-900/10 border-amber-500/10",   badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",   label: `${days}d`, icon: "🟡" };
  return             { row: "bg-slate-800/20 border-slate-700/20",    badge: "bg-slate-700/30 text-gray-400 border-slate-600/30",  label: `${days}d`, icon: "🟢" };
}

export default function UpcomingExpirations({
  projects,
  warningDays = 90,
}: UpcomingExpirationsProps) {
  // Build a flat list of expiration rows
  const rows: ExpirationRow[] = [];

  for (const p of projects) {
    if (p.dominio_vencimiento) {
      const days = daysUntil(p.dominio_vencimiento);
      if (days <= warningDays) {
        rows.push({
          projectId:   p.id,
          projectName: p.proyecto,
          clientName:  p.cliente_nombre,
          type:        "dominio",
          name:        p.dominio_nombre     || "Dominio",
          provider:    p.dominio_provider   || "—",
          daysLeft:    days,
          dateStr:     p.dominio_vencimiento,
        });
      }
    }
    if (p.hosting_vencimiento) {
      const days = daysUntil(p.hosting_vencimiento);
      if (days <= warningDays) {
        rows.push({
          projectId:   p.id,
          projectName: p.proyecto,
          clientName:  p.cliente_nombre,
          type:        "hosting",
          name:        p.hosting_plan     || "Hosting",
          provider:    p.hosting_provider || "—",
          daysLeft:    days,
          dateStr:     p.hosting_vencimiento,
        });
      }
    }
  }

  // Sort: most urgent first
  rows.sort((a, b) => a.daysLeft - b.daysLeft);

  if (rows.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
          <h2 className="text-lg font-bold text-white">Próximos Vencimientos</h2>
        </div>
        <div className="flex items-center gap-3 text-emerald-400 py-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Sin vencimientos en los próximos {warningDays} días. ✅</p>
        </div>
      </div>
    );
  }

  const urgent = rows.filter(r => r.daysLeft <= 30).length;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-500 rounded-full" />
          <h2 className="text-lg font-bold text-white">Próximos Vencimientos</h2>
          {urgent > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              {urgent} urgente{urgent !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">Próximos {warningDays} días</p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Proyecto / Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Activo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Proveedor</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Vence</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Días</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Ver</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const s = urgencyStyle(row.daysLeft);
              return (
                <tr
                  key={`${row.projectId}-${row.type}-${i}`}
                  className={`border-b border-slate-700/20 transition ${s.row}`}
                >
                  {/* Proyecto */}
                  <td className="px-4 py-3">
                    <p className={`font-semibold ${row.daysLeft <= 30 ? "text-white" : "text-gray-200"}`}>
                      {row.projectName}
                    </p>
                    <p className="text-xs text-gray-500">{row.clientName}</p>
                  </td>

                  {/* Tipo + nombre */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.type === "dominio"
                        ? <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        : <Server className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      }
                      <div>
                        <p className="text-gray-200 text-xs font-medium">{row.name}</p>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                          {row.type === "dominio" ? "Dominio" : "Hosting"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Proveedor */}
                  <td className="px-4 py-3 text-gray-400 text-xs">{row.provider}</td>

                  {/* Fecha */}
                  <td className="px-4 py-3 text-center">
                    <p className={`text-xs font-mono ${row.daysLeft <= 14 ? "text-red-300 font-bold" : "text-gray-300"}`}>
                      {formatDateCL(row.dateStr)}
                    </p>
                  </td>

                  {/* Badge días */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${s.badge}`}>
                      {s.icon} {s.label}
                    </span>
                  </td>

                  {/* Acción */}
                  <td className="px-4 py-3 text-center">
                    <Link
                      to={`/proyecto/${row.projectId}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-blue-400 hover:bg-blue-500/20 transition"
                      title={`Ver proyecto ${row.projectName}`}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-700/30">
        {rows.map((row, i) => {
          const s = urgencyStyle(row.daysLeft);
          return (
            <div key={`m-${row.projectId}-${row.type}-${i}`} className={`p-4 ${s.row}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{row.projectName}</p>
                  <p className="text-gray-500 text-xs">{row.clientName}</p>
                </div>
                <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${s.badge}`}>
                  {s.icon} {s.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {row.type === "dominio"
                    ? <Globe className="w-3.5 h-3.5 text-blue-400" />
                    : <Server className="w-3.5 h-3.5 text-purple-400" />
                  }
                  <p className="text-xs text-gray-300">{row.name} · {row.provider}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`text-xs font-mono ${row.daysLeft <= 14 ? "text-red-300 font-bold" : "text-gray-400"}`}>
                    {formatDateCL(row.dateStr)}
                  </p>
                  <Link
                    to={`/proyecto/${row.projectId}`}
                    className="text-blue-400 hover:text-blue-300 text-sm font-bold"
                  >→</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
