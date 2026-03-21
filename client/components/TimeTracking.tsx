import { useState } from "react";
import axios from "axios";
import { Loader2, AlertCircle, CheckCircle2, Plus, Trash2, Clock } from "lucide-react";
import { safeFormatDate, safeFormatCurrency } from "@/utils/dateFormatter";

export interface TimeEntry {
  id: number;
  proyecto_id: number;
  horas: number;
  descripcion: string;
  fecha: string;
}

interface TimeTrackingProps {
  projectId: number;
  estimatedHours: number;
  projectTotal: number;
  timeEntries: TimeEntry[];
  onTimeEntriesUpdate: (entries: TimeEntry[]) => void;
  onRegisterSuccess?: () => Promise<void> | void;
  rol?: string;
}

export default function TimeTracking({
  projectId,
  estimatedHours,
  projectTotal,
  timeEntries,
  onTimeEntriesUpdate,
  onRegisterSuccess,
  rol,
}: TimeTrackingProps) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    horas: "",
    descripcion: "",
    fecha: new Date().toISOString().split("T")[0],
  });

  const totalRealHours = timeEntries.reduce((sum, entry) => sum + entry.horas, 0);
  const hoursRemaining = Math.max(estimatedHours - totalRealHours, 0);
  const progressPercentage = Math.min((totalRealHours / estimatedHours) * 100, 100);
  const isOverBudget = totalRealHours > estimatedHours;
  const realHourlyValue = totalRealHours > 0 ? projectTotal / totalRealHours : 0;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!formData.horas || !formData.descripcion || !formData.fecha) {
      setError("Por favor completa todos los campos");
      setLoading(false);
      return;
    }

    try {
      const horas = parseFloat(formData.horas);
      if (horas <= 0) {
        setError("Las horas deben ser mayores a 0");
        setLoading(false);
        return;
      }

      const dataToSend = {
        proyecto_id: projectId,
        horas: horas,
        descripcion: formData.descripcion,
        fecha_trabajo: formData.fecha,
      };

      console.log('📝 Enviando datos de horas:', dataToSend);

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/registrar_horas.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log('✅ Respuesta del servidor:', response.status, response.data);

      if (response.status === 200 || response.status === 201) {
        setSuccess(true);
        setFormData({
          horas: "",
          descripcion: "",
          fecha: new Date().toISOString().split("T")[0],
        });

        // Call parent callback to refresh full project data
        if (onRegisterSuccess) {
          console.log('✅ Horas registradas exitosamente, ejecutando fetchProjectData...');
          await onRegisterSuccess();
        } else {
          // Fallback: Fetch updated time entries locally
          try {
            const timestamp = new Date().getTime();
            const entriesResponse = await axios.get(
              `https://crm.claudiogonzalez.dev/api/obtener_horas.php?proyecto_id=${projectId}&t=${timestamp}`
            );
            const entriesData = Array.isArray(entriesResponse.data)
              ? entriesResponse.data
              : entriesResponse.data.horas || [];

            const sanitizedEntries = entriesData.map((e: any) => ({
              id: e.id,
              proyecto_id: e.proyecto_id,
              horas: parseFloat(e.horas) || 0,
              descripcion: e.descripcion,
              fecha: e.fecha,
            }));

            onTimeEntriesUpdate(sanitizedEntries);
          } catch (err) {
            console.error("Error fetching updated time entries:", err);
          }
        }

        setTimeout(() => {
          setSuccess(false);
          setShowForm(false);
        }, 2000);
      }
    } catch (err) {
      console.error('❌ Error al registrar horas:', err);
      if (axios.isAxiosError(err)) {
        console.error('  Response Status:', err.response?.status);
        console.error('  Response Data:', err.response?.data);
        console.error('  Error Message:', err.message);
      }
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al registrar horas"
          : "Error al registrar horas"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este registro?")) {
      return;
    }

    try {
      const dataToSend = {
        id: entryId,
      };

      console.log('🗑️ Eliminando hora:', dataToSend);

      await axios.post(
        "https://crm.claudiogonzalez.dev/api/eliminar_horas.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log('✅ Hora eliminada correctamente');

      // Fetch updated time entries
      try {
        const timestamp = new Date().getTime();
        const entriesResponse = await axios.get(
          `https://crm.claudiogonzalez.dev/api/obtener_horas.php?proyecto_id=${projectId}&t=${timestamp}`
        );
        const entriesData = Array.isArray(entriesResponse.data)
          ? entriesResponse.data
          : entriesResponse.data.horas || [];

        const sanitizedEntries = entriesData.map((e: any) => ({
          id: e.id,
          proyecto_id: e.proyecto_id,
          horas: parseFloat(e.horas) || 0,
          descripcion: e.descripcion,
          fecha: e.fecha,
        }));

        onTimeEntriesUpdate(sanitizedEntries);
      } catch (err) {
        console.error("Error fetching updated time entries:", err);
        if (axios.isAxiosError(err)) {
          console.error('  Status:', err.response?.status);
          console.error('  Data:', err.response?.data);
        }
      }
    } catch (err) {
      console.error("Error deleting time entry:", err);
      if (axios.isAxiosError(err)) {
        console.error('  Status:', err.response?.status);
        console.error('  Data:', err.response?.data);
      }
    }
  };

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
            {totalRealHours.toFixed(1)} <span className="text-sm text-gray-400">/ {estimatedHours}</span>
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
            {progressPercentage.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Real Hourly Value */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
        <p className="text-gray-400 text-xs mb-1">Valor Hora Real Actual</p>
        <p className="text-2xl font-bold text-blue-400">
          {safeFormatCurrency(realHourlyValue)}
          <span className="text-sm text-gray-500 ml-2">
            {realHourlyValue > 0 && `(${totalRealHours.toFixed(1)}h registradas)`}
          </span>
        </p>
      </div>

      {/* Time Entries History */}
      {timeEntries.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-4">Últimos Registros</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
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
                  {rol !== 'colaborador' && (
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded transition flex-shrink-0 ml-3"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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

      {/* Register Time Button - Only for admin */}
      {!showForm && rol !== 'colaborador' && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Registrar Trabajo
        </button>
      )}

      {/* Time Entry Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-6 space-y-4">
          <h4 className="font-semibold text-white mb-4">Registrar Nuevo Trabajo</h4>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-400 text-sm">Trabajo registrado correctamente</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Horas <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                name="horas"
                value={formData.horas}
                onChange={handleInputChange}
                placeholder="Ej: 2.5"
                min="0"
                step="0.25"
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fecha <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                name="fecha"
                value={formData.fecha}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descripción de la Tarea <span className="text-red-400">*</span>
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleInputChange}
              placeholder="Ej: Implementación de formulario de contacto"
              rows={3}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              disabled={loading}
              className="flex-1 py-2 px-4 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-700/50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Registro"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
