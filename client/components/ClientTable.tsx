import { Trash2, Edit2, Eye } from "lucide-react";

export interface Client {
  id: number;
  nombre_empresa: string;
  nombre_contacto: string;
  email: string;
  industria: string;
  inversion_total?: number;  // ← Nuevo: Suma de monto_bruto de proyectos
}

interface ClientTableProps {
  clients: Client[];
  loading: boolean;
  onEdit: (client: Client) => void;
  onDelete: (id: number) => void;
  rol?: string;
}

export default function ClientTable({
  clients,
  loading,
  onEdit,
  onDelete,
  rol,
}: ClientTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No hay clientes registrados</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                Empresa
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                Contacto
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                Email
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                Industria
              </th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                Inversión Total
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const inversionTotal = Math.round(client.inversion_total || 0);

              return (
                <tr
                  key={client.id}
                  className="border-b border-slate-700/30 hover:bg-slate-800/30 transition"
                >
                  <td className="px-6 py-4 text-sm text-gray-100">
                    {client.nombre_empresa}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-100">
                    {client.nombre_contacto || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {client.email}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                      {client.industria || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {inversionTotal > 0 ? (
                      <span className="font-semibold text-emerald-400">
                        {formatCurrency(inversionTotal)}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      {/* Ver Detalles - Visible para todos */}
                      <button
                        onClick={() => onEdit(client)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                        title="Ver Detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {/* Edit y Delete - Solo para Admin */}
                      {rol !== 'colaborador' && (
                        <>
                          <button
                            onClick={() => onEdit(client)}
                            className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(client.id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {clients.map((client) => {
          const inversionTotal = Math.round(client.inversion_total || 0);

          return (
            <div
              key={client.id}
              className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-lg p-4 space-y-3"
            >
              {/* Empresa Title */}
              <h3 className="text-sm font-bold text-white break-words">
                {client.nombre_empresa}
              </h3>

              {/* Data Rows */}
              <div className="space-y-2 text-xs">
                {/* Contacto */}
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">Contacto:</span>
                  <span className="text-gray-100 text-right">
                    {client.nombre_contacto || "—"}
                  </span>
                </div>

                {/* Email */}
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">Email:</span>
                  <span className="text-gray-300 text-right break-words">
                    {client.email}
                  </span>
                </div>

                {/* Industria */}
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0">Industria:</span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                    {client.industria || "—"}
                  </span>
                </div>

                {/* Inversión Total - KPI */}
                <div className="flex justify-between items-end gap-2 pt-2 border-t border-slate-700/30">
                  <span className="text-gray-400 flex-shrink-0">Inversión:</span>
                  {inversionTotal > 0 ? (
                    <span className="font-semibold text-emerald-400 text-right">
                      {formatCurrency(inversionTotal)}
                    </span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </div>
              </div>

              {/* Action Buttons - Full Width */}
              <div className="flex gap-2 pt-2">
                {/* Ver Detalles - Visible para todos */}
                <button
                  onClick={() => onEdit(client)}
                  className="flex-1 py-2 px-3 text-xs text-blue-400 hover:bg-blue-500/20 rounded-lg transition font-semibold flex items-center justify-center gap-2"
                  title="Ver Detalles"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalles
                </button>
                {/* Editar y Eliminar - Solo para Admin */}
                {rol !== 'colaborador' && (
                  <>
                    <button
                      onClick={() => onEdit(client)}
                      className="flex-1 py-2 px-3 text-xs text-amber-400 hover:bg-amber-500/20 rounded-lg transition font-semibold"
                      title="Editar"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(client.id)}
                      className="flex-1 py-2 px-3 text-xs text-red-400 hover:bg-red-500/20 rounded-lg transition font-semibold"
                      title="Eliminar"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
