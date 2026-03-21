import { Link } from "react-router-dom";
import { Eye, Globe, Server, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";

export interface Project {
  id: number;
  proyecto: string;
  cliente_nombre: string;
  estado: string;
  monto_liquido?: number;
  monto_bruto?: number;
  monto_total_contrato?: number;
  total_pagado?: number;
  saldo_pendiente?: number;
  cliente_id?: number;
  // Asset fields
  dominio_nombre?: string | null;
  dominio_provider?: string | null;
  dominio_vencimiento?: string | null;
  hosting_provider?: string | null;
  hosting_plan?: string | null;
  hosting_vencimiento?: string | null;
}

interface ProjectsTableProps {
  projects: Project[];
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Cotización: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Desarrollo Inicial": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "En Desarrollo": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Revisiones: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Finalizado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Cobrado: "bg-green-500/20 text-green-400 border-green-500/30",
};

const getStatusColor = (status: string): string => {
  if (STATUS_COLORS[status]) return STATUS_COLORS[status];
  if (status.includes("Revisión")) return STATUS_COLORS["En Desarrollo"];
  return STATUS_COLORS["Revisiones"];
};

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-CL", {
    timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

/** Returns the most urgent asset (lowest days) for a project */
function getMostUrgentAsset(p: Project): { type: "dominio" | "hosting"; days: number; dateStr: string; name: string; provider: string } | null {
  const candidates = [];
  if (p.dominio_vencimiento) {
    candidates.push({ type: "dominio" as const, days: daysUntil(p.dominio_vencimiento), dateStr: p.dominio_vencimiento, name: p.dominio_nombre || "Dominio", provider: p.dominio_provider || "—" });
  }
  if (p.hosting_vencimiento) {
    candidates.push({ type: "hosting" as const, days: daysUntil(p.hosting_vencimiento), dateStr: p.hosting_vencimiento, name: p.hosting_plan || "Hosting", provider: p.hosting_provider || "—" });
  }
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.days - b.days)[0];
}

function assetUrgencyClass(days: number): string {
  if (days < 0)   return "text-red-400 font-bold";
  if (days <= 14) return "text-red-400 font-bold";
  if (days <= 30) return "text-orange-400 font-semibold";
  if (days <= 60) return "text-amber-400";
  return "text-gray-400";
}

/** Tooltip content string */
function buildTooltip(p: Project): string {
  const parts: string[] = [];
  if (p.dominio_vencimiento) parts.push(`🌐 Dominio${p.dominio_nombre ? ` (${p.dominio_nombre})` : ""}: vence ${formatDateShort(p.dominio_vencimiento)}${p.dominio_provider ? ` — ${p.dominio_provider}` : ""}`);
  if (p.hosting_vencimiento) parts.push(`🖥️ Hosting${p.hosting_plan ? ` (${p.hosting_plan})` : ""}: vence ${formatDateShort(p.hosting_vencimiento)}${p.hosting_provider ? ` — ${p.hosting_provider}` : ""}`);
  return parts.join("\n") || "Sin activos registrados";
}

export default function ProjectsTable({ projects, loading }: ProjectsTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No hay proyectos registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Desktop Table ─────────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Proyecto</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Cliente</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Estado</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Total Contrato</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Pagado</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Saldo</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Progreso</th>
              {/* NEW: Assets column */}
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Activos</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const totalContrato = Math.round(project.monto_total_contrato || project.monto_bruto || 0);
              const totalPagado   = Math.round(project.total_pagado || 0);
              const saldo         = Math.round(project.saldo_pendiente ?? Math.max(totalContrato - totalPagado, 0));
              const porcentaje    = totalContrato > 0 ? Math.round((totalPagado / totalContrato) * 100) : 0;
              const asset         = getMostUrgentAsset(project);
              const tooltip       = buildTooltip(project);
              const hasAssets     = !!(project.dominio_vencimiento || project.hosting_vencimiento || project.dominio_nombre || project.hosting_provider);

              return (
                <tr key={project.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition">
                  <td className="px-6 py-4 text-sm text-gray-100">{project.proyecto}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{project.cliente_nombre || "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.estado)}`}>
                      {project.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {totalContrato > 0
                      ? <span className="font-semibold text-emerald-400">{formatCurrency(totalContrato)}</span>
                      : <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {totalPagado > 0
                      ? <span className="font-semibold text-blue-400">{formatCurrency(totalPagado)}</span>
                      : <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {saldo > 0
                      ? <span className="font-semibold text-orange-400">{formatCurrency(saldo)}</span>
                      : <span className="text-emerald-400 font-semibold">Completo</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600/50">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                          style={{ width: `${Math.min(porcentaje, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-400 w-8 text-right">{porcentaje}%</span>
                    </div>
                  </td>

                  {/* ── Asset cell with tooltip ──────────────────────────────── */}
                  <td className="px-6 py-4 text-center">
                    {hasAssets ? (
                      <div className="group relative inline-flex flex-col items-center gap-1">
                        {/* Icons row */}
                        <div className="flex items-center gap-1.5">
                          {project.dominio_vencimiento && (
                            <Globe className={`w-4 h-4 ${assetUrgencyClass(daysUntil(project.dominio_vencimiento))}`} />
                          )}
                          {project.hosting_vencimiento && (
                            <Server className={`w-4 h-4 ${assetUrgencyClass(daysUntil(project.hosting_vencimiento))}`} />
                          )}
                          {/* Show only icons if no vencimiento set */}
                          {!project.dominio_vencimiento && project.dominio_nombre && (
                            <Globe className="w-4 h-4 text-gray-500" />
                          )}
                          {!project.hosting_vencimiento && project.hosting_provider && (
                            <Server className="w-4 h-4 text-gray-500" />
                          )}
                        </div>

                        {/* Most urgent expiration date */}
                        {asset && (
                          <span className={`text-[10px] font-mono leading-none ${assetUrgencyClass(asset.days)}`}>
                            {asset.days < 0 ? "VENCIDO" : asset.days <= 90 ? `${asset.days}d` : formatDateShort(asset.dateStr)}
                          </span>
                        )}

                        {/* Alert icon for very urgent */}
                        {asset && asset.days <= 14 && (
                          <AlertTriangle className="w-3 h-3 text-red-400 absolute -top-1 -right-1" />
                        )}

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20
                                        hidden group-hover:block
                                        w-64 bg-slate-900 border border-slate-600/70 rounded-xl
                                        shadow-2xl shadow-black/50 p-3 pointer-events-none">
                          <p className="text-xs font-semibold text-gray-300 mb-2 border-b border-slate-700/50 pb-1.5">
                            {project.proyecto}
                          </p>
                          {project.dominio_nombre || project.dominio_vencimiento ? (
                            <div className="mb-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                <p className="text-xs font-semibold text-blue-300">Dominio</p>
                              </div>
                              {project.dominio_nombre && <p className="text-xs text-gray-300 pl-5">{project.dominio_nombre}</p>}
                              {project.dominio_provider && <p className="text-xs text-gray-500 pl-5">Proveedor: {project.dominio_provider}</p>}
                              {project.dominio_vencimiento && (
                                <p className={`text-xs pl-5 font-mono ${assetUrgencyClass(daysUntil(project.dominio_vencimiento))}`}>
                                  Vence: {formatDateShort(project.dominio_vencimiento)}
                                  {daysUntil(project.dominio_vencimiento) <= 90 && ` (${daysUntil(project.dominio_vencimiento)}d)`}
                                </p>
                              )}
                            </div>
                          ) : null}
                          {project.hosting_provider || project.hosting_vencimiento ? (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Server className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                <p className="text-xs font-semibold text-purple-300">Hosting</p>
                              </div>
                              {project.hosting_provider && <p className="text-xs text-gray-300 pl-5">{project.hosting_provider}</p>}
                              {project.hosting_plan && <p className="text-xs text-gray-500 pl-5">Plan: {project.hosting_plan}</p>}
                              {project.hosting_vencimiento && (
                                <p className={`text-xs pl-5 font-mono ${assetUrgencyClass(daysUntil(project.hosting_vencimiento))}`}>
                                  Vence: {formatDateShort(project.hosting_vencimiento)}
                                  {daysUntil(project.hosting_vencimiento) <= 90 && ` (${daysUntil(project.hosting_vencimiento)}d)`}
                                </p>
                              )}
                            </div>
                          ) : null}
                          {/* Triangle */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                                          border-l-4 border-r-4 border-t-4
                                          border-l-transparent border-r-transparent border-t-slate-600/70" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-center">
                    <Link
                      to={`/proyecto/${project.id}`}
                      className="inline-flex items-center gap-2 px-3 py-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-xs font-semibold">Ver</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ──────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {projects.map((project) => {
          const totalContrato = Math.round(project.monto_total_contrato || project.monto_bruto || 0);
          const totalPagado   = Math.round(project.total_pagado || 0);
          const saldo         = Math.round(project.saldo_pendiente ?? Math.max(totalContrato - totalPagado, 0));
          const porcentaje    = totalContrato > 0 ? Math.round((totalPagado / totalContrato) * 100) : 0;
          const asset         = getMostUrgentAsset(project);

          return (
            <div key={project.id} className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-white break-words">{project.proyecto}</h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">Cliente:</span>
                  <span className="text-gray-100 text-right">{project.cliente_nombre || "—"}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">Estado:</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(project.estado)}`}>
                    {project.estado}
                  </span>
                </div>

                {/* Asset info on mobile */}
                {asset && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-gray-400 flex-shrink-0">Activos:</span>
                    <span className={`text-right text-xs font-mono flex items-center gap-1 ${assetUrgencyClass(asset.days)}`}>
                      {asset.type === "dominio" ? <Globe className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                      {asset.days < 0 ? "VENCIDO" : `${asset.days}d`} — {formatDateShort(asset.dateStr)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700/30 space-y-2">
                  <div className="flex justify-between items-end gap-2">
                    <span className="text-gray-400 flex-shrink-0">Total:</span>
                    {totalContrato > 0
                      ? <span className="font-semibold text-emerald-400">{formatCurrency(totalContrato)}</span>
                      : <span className="text-gray-500">—</span>}
                  </div>
                  <div className="flex justify-between items-end gap-2">
                    <span className="text-gray-400 flex-shrink-0">Saldo:</span>
                    {saldo > 0
                      ? <span className="font-semibold text-orange-400">{formatCurrency(saldo)}</span>
                      : <span className="text-emerald-400 font-semibold">Completo</span>}
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400 text-xs">Progreso:</span>
                      <span className="text-xs font-semibold text-gray-400">{porcentaje}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600/50">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to={`/proyecto/${project.id}`}
                className="w-full py-2 px-3 text-xs text-blue-400 hover:bg-blue-500/20 rounded-lg transition font-semibold text-center block"
              >
                Ver Detalles
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
