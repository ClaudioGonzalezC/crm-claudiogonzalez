import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, AlertCircle, LogOut, Settings, ArrowLeft, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_TERMS } from "@/constants/terms";
import { calcCostoExtraBruto } from "@/constants/financial";
import ProfitabilityCalculator from "@/components/ProfitabilityCalculator";
import InvoiceSummary from "@/components/InvoiceSummary";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";

interface Client {
  id: number;
  nombre_empresa: string;
  nombre_contacto?: string;
}

interface FormData {
  cliente_id: string;
  nombre_proyecto: string;
  horas_estimadas: string;
  revisiones_incluidas: string;
  valor_hora_acordado: string;
  dominio_nombre?: string;
  dominio_provider?: string;
  dominio_vencimiento?: string;
  hosting_provider?: string;
  hosting_plan?: string;
  hosting_vencimiento?: string;
  terminos_condiciones?: string;
}

interface CostoExtra {
  descripcion: string;
  monto_neto: string;
  visible_cliente: boolean;
}

const DEFAULT_MIN_HOURLY_RATE = 48735;

// Generate a random share token for client access
const generateShareToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export default function ProjectForm() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // State Management
  const [formData, setFormData] = useState<FormData>({
    cliente_id: "",
    nombre_proyecto: "",
    horas_estimadas: "",
    revisiones_incluidas: "",
    valor_hora_acordado: "",
    dominio_nombre: "",
    dominio_provider: "",
    dominio_vencimiento: "",
    hosting_provider: "",
    hosting_plan: "",
    hosting_vencimiento: "",
    terminos_condiciones: DEFAULT_TERMS,
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [minimumHourlyRate, setMinimumHourlyRate] = useState(
    DEFAULT_MIN_HOURLY_RATE
  );
  const [costos_extra, setCostosExtra] = useState<CostoExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fetch clients and config on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError("");

    try {
      // Fetch clients
      const clientsResponse = await axios.get(
        "https://crm.claudiogonzalez.dev/api/get_clientes.php"
      );
      const clientsData = Array.isArray(clientsResponse.data)
        ? clientsResponse.data
        : clientsResponse.data.clientes || [];
      setClients(clientsData);

      // Fetch config for minimum hourly rate
      try {
        const configResponse = await axios.get(
          "https://crm.claudiogonzalez.dev/api/get_config.php"
        );
        if (configResponse.data.valor_hora) {
          setMinimumHourlyRate(configResponse.data.valor_hora);
        }
      } catch (err) {
        // Use default if config fetch fails
        console.error("Error fetching config:", err);
      }
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message ||
              "Error al cargar los datos iniciales"
          : "Error al cargar los datos iniciales"
      );
    } finally {
      setLoading(false);
    }
  };

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

  const handleAddCostoExtra = () => {
    setCostosExtra([...costos_extra, { descripcion: "", monto_neto: "", visible_cliente: true }]);
  };

  const handleRemoveCostoExtra = (index: number) => {
    setCostosExtra(costos_extra.filter((_, i) => i !== index));
  };

  const handleCostoExtraChange = (
    index: number,
    field: keyof CostoExtra,
    value: string
  ) => {
    const updatedCostos = [...costos_extra];
    updatedCostos[index] = {
      ...updatedCostos[index],
      [field]: value,
    };
    setCostosExtra(updatedCostos);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    // Validation
    if (
      !formData.cliente_id ||
      !formData.nombre_proyecto ||
      !formData.horas_estimadas ||
      !formData.valor_hora_acordado
    ) {
      setError("Por favor completa todos los campos requeridos");
      setSubmitting(false);
      return;
    }

    try {
      // Generate unique share token for client portal access
      const shareToken = generateShareToken();

      // Filter out empty costos_extra
      const validCostosExtra = costos_extra.filter(
        (costo) => costo.descripcion.trim() && costo.monto_neto.trim()
      );

      const dataToSend = {
        cliente_id: parseInt(formData.cliente_id),
        nombre_proyecto: formData.nombre_proyecto,
        horas_estimadas: parseInt(formData.horas_estimadas),
        revisiones_totales: parseInt(formData.revisiones_incluidas) || 0,
        valor_hora_acordado: parseInt(formData.valor_hora_acordado),
        share_token: shareToken,
        dominio_nombre: formData.dominio_nombre || null,
        dominio_provider: formData.dominio_provider || null,
        dominio_vencimiento: formData.dominio_vencimiento || null,
        hosting_provider: formData.hosting_provider || null,
        hosting_plan: formData.hosting_plan || null,
        hosting_vencimiento: formData.hosting_vencimiento || null,
        terminos_condiciones: formData.terminos_condiciones || DEFAULT_TERMS,
        costos_extra: validCostosExtra.map((costo) => {
          // REGLA 2/3 (financial.ts):
          //   visible  → monto_bruto = monto_neto (reembolso 1:1, sin retención)
          //   oculto   → monto_bruto = grossUp(monto_neto) = neto / 0.8475
          //              El cliente paga el bruto inflado, tú recibes el neto deseado
          const montoNeto = parseInt(costo.monto_neto) || 0;
          const montoBruto = calcCostoExtraBruto(montoNeto, costo.visible_cliente);
          return {
            descripcion:     costo.descripcion.trim(),
            monto_liquido:   montoNeto,   // Lo que el profesional desea recibir
            monto_bruto:     montoBruto,  // Lo que el cliente paga (con gross-up si oculto)
            visible_cliente: costo.visible_cliente,
          };
        }),
      };

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/crear_proyecto.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      setSuccess(true);
      // Redirect to project detail after 2 seconds
      const projectId = response.data.id || response.data.proyecto_id;
      setTimeout(() => {
        navigate(`/proyecto/${projectId}`);
      }, 2000);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al crear proyecto"
          : "Error al crear proyecto"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hoursValue = parseInt(formData.horas_estimadas) || 0;
  const hourlyRateValue = parseInt(formData.valor_hora_acordado) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header - Responsive Mobile/Desktop Separation */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-40 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-4 lg:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
          {/* Mobile ROW 1: Logo + Buttons (icons only) */}
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center justify-center text-blue-400 hover:text-blue-300 transition px-2 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-blue-500/10"
                title="Volver al Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link
                to="/ajustes"
                className="inline-flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition px-2 py-2 min-h-[44px] min-w-[44px]"
                title="Ajustes de perfil"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition px-2 py-2 min-h-[44px] min-w-[44px]"
                title="Cerrar sesión"
                type="button"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile ROW 2: Title Section */}
          <div className="lg:hidden">
            <h1 className="text-xl font-bold text-white mb-1 break-words">
              Nuevo Proyecto
            </h1>
            <p className="text-gray-400 text-xs">
              Registra un nuevo proyecto y calcula su rentabilidad
            </p>
          </div>

          {/* Desktop ROW (single line): Logo | Title+Description | Actions */}
          <div className="hidden lg:flex lg:items-center lg:justify-between lg:flex-1 gap-6">
            <Logo size="md" />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1 break-words">
                Nuevo Proyecto
              </h1>
              <p className="text-gray-400 text-sm break-words">
                Registra un nuevo proyecto y calcula su rentabilidad
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                to="/"
                className="inline-flex items-center justify-center text-blue-400 hover:text-blue-300 transition px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-blue-500/10"
                title="Volver al Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="ml-2 text-sm">Dashboard</span>
              </Link>
              <Link
                to="/ajustes"
                className="inline-flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition px-3 py-2 min-h-[44px] min-w-[44px]"
                title="Ajustes de perfil"
              >
                <Settings className="w-5 h-5" />
                <span className="ml-2 text-sm font-semibold">Ajustes</span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition px-3 py-2 min-h-[44px] min-w-[44px]"
                title="Cerrar sesión"
                type="button"
              >
                <LogOut className="w-5 h-5" />
                <span className="ml-2 text-sm font-semibold">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {success && (
          <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <p className="text-emerald-400 font-semibold">
              ¡Proyecto creado exitosamente! Redirigiendo a detalles del proyecto...
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 overflow-x-hidden">
            {/* Form Section */}
            <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Cliente <span className="text-red-400">*</span>
                </label>
                <select
                  name="cliente_id"
                  value={formData.cliente_id}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nombre_empresa}
                      {client.nombre_contacto ? ` - ${client.nombre_contacto}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Nombre del Proyecto <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="nombre_proyecto"
                  value={formData.nombre_proyecto}
                  onChange={handleInputChange}
                  required
                  placeholder="Ej: Rediseño de sitio web, App móvil, etc."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>

              {/* Estimated Hours & Revisions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    Horas Estimadas <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="horas_estimadas"
                    value={formData.horas_estimadas}
                    onChange={handleInputChange}
                    required
                    min="1"
                    placeholder="Ej: 40"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-2">
                    Revisiones Incluidas
                  </label>
                  <input
                    type="number"
                    name="revisiones_incluidas"
                    value={formData.revisiones_incluidas}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="Ej: 3"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>

              {/* Hourly Rate - MONTO BRUTO */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Valor Hora Acordado (BRUTO) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  name="valor_hora_acordado"
                  value={formData.valor_hora_acordado}
                  onChange={handleInputChange}
                  required
                  min="0"
                  placeholder="Ej: 50000"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                />
                <p className="text-gray-500 text-xs mt-2">
                  💡 Este es el monto BRUTO que cobra el cliente. El backend aplicará automáticamente la retención del 15.25%.
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Tu valor hora mínimo es: ${minimumHourlyRate.toLocaleString("es-CL")} (BRUTO)
                </p>
              </div>
            </div>

            {/* Extra Costs Initial Section - OPTIONAL */}
            <div className="border-t border-slate-700/50 pt-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-200">Costos Extra Iniciales (Opcional)</h3>
              </div>

              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Añade gastos o costos reembolsables que se incluirán en el monto total del proyecto.
                </p>

                {costos_extra.length > 0 ? (
                  <div className="space-y-3">
                    {costos_extra.map((costo, index) => (
                      <div key={index} className="space-y-3 p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-300 mb-2">
                              Descripción
                            </label>
                            <input
                              type="text"
                              value={costo.descripcion}
                              onChange={(e) =>
                                handleCostoExtraChange(index, "descripcion", e.target.value)
                              }
                              placeholder="Ej: Licencia de software, Hosting"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition text-sm"
                            />
                          </div>
                          <div className="w-32">
                            <label className="block text-xs font-semibold text-gray-300 mb-2">
                              Monto Neto
                            </label>
                            <input
                              type="number"
                              value={costo.monto_neto}
                              onChange={(e) =>
                                handleCostoExtraChange(index, "monto_neto", e.target.value)
                              }
                              placeholder="0"
                              min="0"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCostoExtra(index)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded transition mb-0"
                            title="Eliminar costo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedCostos = [...costos_extra];
                              updatedCostos[index] = {
                                ...updatedCostos[index],
                                visible_cliente: !updatedCostos[index].visible_cliente,
                              };
                              setCostosExtra(updatedCostos);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded transition"
                          >
                            {costo.visible_cliente ? (
                              <Eye className="w-4 h-4 text-blue-400" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-gray-500" />
                            )}
                            <span className="text-xs font-semibold text-gray-400">
                              {costo.visible_cliente ? "Visible para el cliente" : "Oculto del cliente"}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">Sin costos extras añadidos aún</p>
                )}

                <button
                  type="button"
                  onClick={handleAddCostoExtra}
                  className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition font-semibold text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Costo Extra
                </button>

                <p className="text-gray-500 text-xs p-3 bg-slate-800/20 rounded-lg border border-slate-700/30">
                  ℹ️ Estos costos se incluirán en el monto total del contrato y se facturarán al cliente.
                </p>
              </div>
            </div>

            {/* Asset Management Section - OPTIONAL */}
            <div className="border-t border-slate-700/50 pt-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-200">Gestión de Activos (Opcional)</h3>
              </div>

              {/* Domain Section */}
              <div className="mb-8 space-y-4">
                <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  🌐 Dominio
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Nombre del Dominio
                    </label>
                    <input
                      type="text"
                      name="dominio_nombre"
                      value={formData.dominio_nombre || ""}
                      onChange={handleInputChange}
                      placeholder="Ej: midominio.cl"
                      className="w-full max-w-full box-border px-3 py-2 bg-slate-800/30 border border-slate-600/30 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Proveedor
                    </label>
                    <input
                      type="text"
                      name="dominio_provider"
                      value={formData.dominio_provider || ""}
                      onChange={handleInputChange}
                      placeholder="Ej: Godaddy, Registrodata"
                      className="w-full max-w-full box-border px-3 py-2 bg-slate-800/30 border border-slate-600/30 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Vencimiento
                    </label>
                    <input
                      type="date"
                      name="dominio_vencimiento"
                      value={formData.dominio_vencimiento || ""}
                      onChange={handleInputChange}
                      className="w-full max-w-full box-border px-3 py-2 bg-slate-800/30 border border-slate-600/30 rounded-lg text-white focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Hosting Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  🖥️ Hosting
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Proveedor
                    </label>
                    <input
                      type="text"
                      name="hosting_provider"
                      value={formData.hosting_provider || ""}
                      onChange={handleInputChange}
                      placeholder="Ej: AWS, Vercel, Netlify"
                      className="w-full max-w-full box-border px-3 py-2 bg-slate-800/30 border border-slate-600/30 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Plan
                    </label>
                    <input
                      type="text"
                      name="hosting_plan"
                      value={formData.hosting_plan || ""}
                      onChange={handleInputChange}
                      placeholder="Ej: Pro, Enterprise"
                      className="w-full max-w-full box-border px-3 py-2 bg-slate-800/30 border border-slate-600/30 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-2">
                      Vencimiento
                    </label>
                    <input
                      type="date"
                      name="hosting_vencimiento"
                      value={formData.hosting_vencimiento || ""}
                      onChange={handleInputChange}
                      className="w-full max-w-full box-border px-3 py-2 bg-slate-800/30 border border-slate-600/30 rounded-lg text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition text-sm"
                    />
                  </div>
                </div>
              </div>

              <p className="text-gray-500 text-xs mt-6 p-3 bg-slate-800/20 rounded-lg border border-slate-700/30">
                ℹ️ Estos datos son opcionales. Si los completas, podrás visualizar alertas de vencimiento en el portal del cliente.
              </p>
            </div>

            {/* Terms and Agreement Section */}
            <div className="border-t border-slate-700/50 pt-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
                <h3 className="text-lg font-semibold text-gray-200">Acuerdo de Proyecto (Opcional)</h3>
              </div>

              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Términos del Acuerdo
              </label>
              <textarea
                name="terminos_condiciones"
                value={formData.terminos_condiciones || ""}
                onChange={handleInputChange}
                rows={10}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition font-mono text-sm resize-none"
                placeholder="Ingresa los términos del acuerdo..."
              />
              <p className="text-gray-500 text-xs mt-2 p-3 bg-slate-800/20 rounded-lg border border-slate-700/30">
                ℹ️ Estos términos se mostrarán al cliente cuando acceda al portal. El cliente debe aceptarlos antes de proceder. Se proporciona una plantilla por defecto que puedes editar.
              </p>
            </div>

            {/* Profitability Calculator */}
            {hourlyRateValue > 0 && (
              <ProfitabilityCalculator
                hourlyRate={hourlyRateValue}
                minimumHourlyRate={minimumHourlyRate}
                hours={hoursValue}
              />
            )}

            {/* Invoice Summary */}
            {hoursValue > 0 && hourlyRateValue > 0 && (
              <InvoiceSummary
                hours={hoursValue}
                hourlyRate={hourlyRateValue}
                projectName={formData.nombre_proyecto}
                costosExtra={costos_extra}
              />
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <Link
                to="/"
                className="flex-1 py-3 px-6 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-800/50 transition font-semibold text-center"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={submitting || success}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando Proyecto...
                  </>
                ) : success ? (
                  "Proyecto Creado"
                ) : (
                  "Crear Proyecto"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}
