import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import axios from "axios";

export interface Client {
  id: number;
  nombre_empresa: string;
  nombre_contacto: string;
  email: string;
  industria: string;
  tamano_empresa?: string;
  presupuesto_estimado?: string;
  objetivo_proyecto?: string;
  competidores?: string;
  referencias?: string;
}

interface EditClientModalProps {
  client: Client | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditClientModal({
  client,
  onClose,
  onSuccess,
}: EditClientModalProps) {
  const [formData, setFormData] = useState<Client>(
    client || {
      id: 0,
      nombre_empresa: "",
      nombre_contacto: "",
      email: "",
      industria: "",
      tamano_empresa: "",
      presupuesto_estimado: "",
      objetivo_proyecto: "",
      competidores: "",
      referencias: "",
    }
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
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

    try {
      // Update endpoint - adjust this to match your backend API
      await axios.post(
        "https://crm.claudiogonzalez.dev/api/actualizar_cliente.php",
        {
          id: formData.id,
          nombre_empresa: formData.nombre_empresa,
          nombre_contacto: formData.nombre_contacto,
          email: formData.email,
          industria: formData.industria,
          tamano_empresa: formData.tamano_empresa,
          presupuesto_estimado: formData.presupuesto_estimado,
          objetivo_proyecto: formData.objetivo_proyecto,
          competidores: formData.competidores,
          referencias: formData.referencias,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al actualizar cliente"
          : "Error al actualizar cliente"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/90 border-b border-slate-700/50 px-8 py-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Editar Cliente</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Row 1: Nombre Empresa & Nombre Contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Nombre Empresa <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="nombre_empresa"
                value={formData.nombre_empresa}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Nombre Contacto
              </label>
              <input
                type="text"
                name="nombre_contacto"
                value={formData.nombre_contacto}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          {/* Row 2: Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Row 3: Industria & Tamaño Empresa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Industria
              </label>
              <select
                name="industria"
                value={formData.industria}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
              >
                <option value="">Seleccionar industria</option>
                <option value="Tecnología">Tecnología</option>
                <option value="E-commerce">E-commerce</option>
                <option value="Educación">Educación</option>
                <option value="Salud">Salud</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Tamaño Empresa
              </label>
              <select
                name="tamano_empresa"
                value={formData.tamano_empresa}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
              >
                <option value="">Seleccionar tamaño</option>
                <option value="Freelance/SME">Freelance/SME</option>
                <option value="10-50 empleados">10-50 empleados</option>
                <option value="50+ empleados">50+ empleados</option>
              </select>
            </div>
          </div>

          {/* Row 4: Presupuesto */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Presupuesto Estimado CLP
            </label>
            <input
              type="number"
              name="presupuesto_estimado"
              value={formData.presupuesto_estimado}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Row 5: Objetivo del Proyecto */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Objetivo del Proyecto
            </label>
            <textarea
              name="objetivo_proyecto"
              value={formData.objetivo_proyecto}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
            />
          </div>

          {/* Row 6: Competidores */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Competidores
            </label>
            <textarea
              name="competidores"
              value={formData.competidores}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
            />
          </div>

          {/* Row 7: Referencias */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Referencias
            </label>
            <textarea
              name="referencias"
              value={formData.referencias}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-6 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-800/50 transition font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
