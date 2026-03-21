import { useState } from "react";
import { AlertTriangle, Globe, Server, Edit2, X, Check, Loader2 } from "lucide-react";
import axios from "axios";

interface AssetStatusCardProps {
  projectId?: number;        // Si se pasa, activa el modo edición
  readOnly?: boolean;        // Forzar solo lectura (portal cliente)
  dominio_nombre?: string;
  dominio_provider?: string;
  dominio_vencimiento?: string;
  hosting_provider?: string;
  hosting_plan?: string;
  hosting_vencimiento?: string;
  onUpdate?: (fields: Partial<AssetStatusCardProps>) => void;
}

interface AssetFormData {
  dominio_nombre:      string;
  dominio_provider:    string;
  dominio_vencimiento: string;
  hosting_provider:    string;
  hosting_plan:        string;
  hosting_vencimiento: string;
}

const calculateDaysUntilExpiration = (expirationDate: string): number => {
  if (!expirationDate) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate + "T00:00:00");
  expDate.setHours(0, 0, 0, 0);
  return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
};

const getExpirationBadgeStyle = (days: number) => {
  if (days <= 30)  return { bgColor: "bg-red-500/20",    borderColor: "border-red-500/30",    textColor: "text-red-400",    icon: "⚠️" };
  if (days <= 60)  return { bgColor: "bg-orange-500/20", borderColor: "border-orange-500/30", textColor: "text-orange-400", icon: "⏱️" };
  return              { bgColor: "bg-emerald-500/20",  borderColor: "border-emerald-500/30", textColor: "text-emerald-400", icon: "✓" };
};

const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const FIELD_INPUT_CLASS =
  "w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm " +
  "placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition";

export default function AssetStatusCard(props: AssetStatusCardProps) {
  const {
    projectId,
    readOnly = false,
    dominio_nombre,
    dominio_provider,
    dominio_vencimiento,
    hosting_provider,
    hosting_plan,
    hosting_vencimiento,
    onUpdate,
  } = props;

  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [saveErr, setSaveErr]   = useState("");
  const [form, setForm] = useState<AssetFormData>({
    dominio_nombre:      dominio_nombre      ?? "",
    dominio_provider:    dominio_provider    ?? "",
    dominio_vencimiento: dominio_vencimiento ?? "",
    hosting_provider:    hosting_provider    ?? "",
    hosting_plan:        hosting_plan        ?? "",
    hosting_vencimiento: hosting_vencimiento ?? "",
  });

  const hasDomainData   = dominio_nombre  || dominio_provider  || dominio_vencimiento;
  const hasHostingData  = hosting_provider || hosting_plan || hosting_vencimiento;
  const canEdit         = !!projectId && !readOnly;

  // If nothing to show AND no edit capability, hide completely
  if (!hasDomainData && !hasHostingData && !canEdit) return null;

  const handleEditOpen = () => {
    setForm({
      dominio_nombre:      dominio_nombre      ?? "",
      dominio_provider:    dominio_provider    ?? "",
      dominio_vencimiento: dominio_vencimiento ?? "",
      hosting_provider:    hosting_provider    ?? "",
      hosting_plan:        hosting_plan        ?? "",
      hosting_vencimiento: hosting_vencimiento ?? "",
    });
    setSaveErr("");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    setSaveErr("");
    try {
      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/actualizar_proyecto.php",
        { id: projectId, ...form }
      );
      if (response.data.status === "success") {
        onUpdate?.(form);
        setEditing(false);
      } else {
        setSaveErr(response.data.message || "Error al guardar");
      }
    } catch (err) {
      setSaveErr(axios.isAxiosError(err) ? (err.response?.data?.message || err.message) : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── EDIT FORM ────────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-blue-500/30 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
            <h2 className="text-2xl font-bold text-white">Editar Activos Digitales</h2>
          </div>
          <button
            onClick={() => setEditing(false)}
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-slate-700/50 rounded-lg transition"
            title="Cancelar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveErr && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {saveErr}
          </div>
        )}

        <div className="space-y-6">
          {/* Dominio */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-semibold text-blue-300 uppercase tracking-wider">Dominio</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre del Dominio</label>
                <input
                  type="text"
                  value={form.dominio_nombre}
                  onChange={e => setForm(f => ({ ...f, dominio_nombre: e.target.value }))}
                  placeholder="midominio.cl"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Proveedor</label>
                <input
                  type="text"
                  value={form.dominio_provider}
                  onChange={e => setForm(f => ({ ...f, dominio_provider: e.target.value }))}
                  placeholder="GoDaddy, NIC Chile…"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Vencimiento</label>
                <input
                  type="date"
                  value={form.dominio_vencimiento}
                  onChange={e => setForm(f => ({ ...f, dominio_vencimiento: e.target.value }))}
                  className={FIELD_INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Hosting */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-purple-400" />
              <p className="text-sm font-semibold text-purple-300 uppercase tracking-wider">Hosting</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Proveedor</label>
                <input
                  type="text"
                  value={form.hosting_provider}
                  onChange={e => setForm(f => ({ ...f, hosting_provider: e.target.value }))}
                  placeholder="AWS, Vercel, SiteGround…"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Plan</label>
                <input
                  type="text"
                  value={form.hosting_plan}
                  onChange={e => setForm(f => ({ ...f, hosting_plan: e.target.value }))}
                  placeholder="Pro, Business…"
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Vencimiento</label>
                <input
                  type="date"
                  value={form.hosting_vencimiento}
                  onChange={e => setForm(f => ({ ...f, hosting_vencimiento: e.target.value }))}
                  className={FIELD_INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-slate-700/50">
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex-1 py-2 px-4 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-700/50 transition font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              <><Check className="w-4 h-4" /> Guardar Activos</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── READ VIEW ────────────────────────────────────────────────────────────────
  // Show an empty-state card when there's no data but edit is possible
  if (!hasDomainData && !hasHostingData) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
            <h2 className="text-2xl font-bold text-white">Activos Digitales</h2>
          </div>
          {canEdit && (
            <button
              onClick={handleEditOpen}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/30 rounded-lg transition font-semibold"
            >
              <Edit2 className="w-4 h-4" />
              Agregar
            </button>
          )}
        </div>
        <p className="text-gray-500 text-sm">No hay activos digitales registrados para este proyecto.</p>
      </div>
    );
  }

  const renderExpirationBadge = (dateStr?: string) => {
    if (!dateStr) return null;
    const days  = calculateDaysUntilExpiration(dateStr);
    const style = getExpirationBadgeStyle(days);
    return (
      <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 whitespace-nowrap ${style.bgColor} ${style.borderColor}`}>
        <span className="text-lg">{style.icon}</span>
        <div className="text-right">
          <p className={`text-xs font-semibold ${style.textColor}`}>{days} día{days !== 1 ? 's' : ''}</p>
          <p className="text-xs text-gray-400">{formatDate(dateStr)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
          <h2 className="text-2xl font-bold text-white">Activos Digitales</h2>
        </div>
        {canEdit && (
          <button
            onClick={handleEditOpen}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/30 rounded-lg transition font-semibold"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Dominio */}
        {hasDomainData && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Globe className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Dominio</h3>
                  {dominio_nombre && <p className="text-sm text-gray-400">{dominio_nombre}</p>}
                </div>
              </div>
              {renderExpirationBadge(dominio_vencimiento)}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/30">
              {dominio_provider    && <div><p className="text-xs text-gray-500 mb-1">Proveedor</p><p className="text-sm font-medium text-gray-300">{dominio_provider}</p></div>}
              {dominio_vencimiento && <div><p className="text-xs text-gray-500 mb-1">Vencimiento</p><p className="text-sm font-medium text-gray-300">{formatDate(dominio_vencimiento)}</p></div>}
            </div>
          </div>
        )}

        {/* Hosting */}
        {hasHostingData && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Server className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Hosting</h3>
                  {hosting_provider && <p className="text-sm text-gray-400">{hosting_provider}</p>}
                </div>
              </div>
              {renderExpirationBadge(hosting_vencimiento)}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/30">
              {hosting_provider    && <div><p className="text-xs text-gray-500 mb-1">Proveedor</p><p className="text-sm font-medium text-gray-300">{hosting_provider}</p></div>}
              {hosting_plan        && <div><p className="text-xs text-gray-500 mb-1">Plan</p><p className="text-sm font-medium text-gray-300">{hosting_plan}</p></div>}
              {hosting_vencimiento && <div className="col-span-2"><p className="text-xs text-gray-500 mb-1">Vencimiento</p><p className="text-sm font-medium text-gray-300">{formatDate(hosting_vencimiento)}</p></div>}
            </div>
          </div>
        )}
      </div>

      {/* Alerta vencimiento urgente */}
      {(() => {
        const dd = dominio_vencimiento ? calculateDaysUntilExpiration(dominio_vencimiento) : 999;
        const dh = hosting_vencimiento ? calculateDaysUntilExpiration(hosting_vencimiento) : 999;
        if (dd > 30 && dh > 30) return null;
        return (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold text-sm">Atención: Vencimiento próximo</p>
              <p className="text-red-300/80 text-xs mt-1">Algunos activos vencen en 30 días o menos. Considera renovarlos para evitar interrupciones.</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
