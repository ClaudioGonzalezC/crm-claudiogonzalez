import { useState } from "react";
import axios from "axios";
import { CheckCircle2, AlertCircle, Loader2, LogOut, Settings, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";

interface FormData {
  nombre_empresa: string;
  nombre_contacto: string;
  email: string;
  industria: string;
  tamano_empresa: string;
  presupuesto_estimado: string;
  objetivo_proyecto: string;
  competidores: string;
  referencias: string;
}

type SubmissionState = "idle" | "loading" | "success" | "error";

export default function CreateClientForm() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    console.log('👋 Ejecutando logout desde CreateClientForm');
    logout();
    navigate('/login');
  };

  const [formData, setFormData] = useState<FormData>({
    nombre_empresa: "",
    nombre_contacto: "",
    email: "",
    industria: "",
    tamano_empresa: "",
    presupuesto_estimado: "",
    objetivo_proyecto: "",
    competidores: "",
    referencias: "",
  });

  const [state, setState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

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

    // Validate required fields
    if (!formData.nombre_empresa.trim() || !formData.email.trim()) {
      setErrorMessage("Nombre de Empresa y Email son requeridos");
      setState("error");
      return;
    }

    setState("loading");
    setErrorMessage("");

    try {
      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/crear_cliente.php",
        formData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        setState("success");
        // Reset form
        setFormData({
          nombre_empresa: "",
          nombre_contacto: "",
          email: "",
          industria: "",
          tamano_empresa: "",
          presupuesto_estimado: "",
          objetivo_proyecto: "",
          competidores: "",
          referencias: "",
        });
        // Reset success message after 5 seconds
        setTimeout(() => {
          setState("idle");
        }, 5000);
      }
    } catch (error) {
      setState("error");
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.message ||
            error.message ||
            "Error al enviar el formulario"
        );
      } else {
        setErrorMessage("Error al enviar el formulario");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header - Responsive Mobile/Desktop Separation */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-40 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
          {/* Mobile ROW 1: Logo + Buttons (side by side) */}
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <Logo size="sm" />
            <div className="flex items-center gap-2">
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
              <Link
                to="/"
                className="inline-flex items-center justify-center text-blue-400 hover:text-blue-300 transition px-2 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-blue-500/10"
                title="Volver al Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Mobile ROW 2: Title (full width) */}
          <div className="lg:hidden">
            <h1 className="text-xl font-bold text-white mb-1 break-words">
              Registrar Nuevo Cliente
            </h1>
            <p className="text-gray-400 text-xs break-words">
              Completa el formulario para comenzar
            </p>
          </div>

          {/* Desktop ROW (single line): Logo | Title | Actions */}
          <div className="hidden lg:flex lg:items-center lg:justify-between lg:flex-1 gap-6">
            <Logo size="sm" />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1 break-words">
                Registrar Nuevo Cliente
              </h1>
              <p className="text-gray-400 text-sm break-words">
                Completa el formulario para comenzar
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                to="/clientes"
                className="text-blue-400 hover:text-blue-300 transition text-sm px-3 py-2"
                title="Ver clientes"
              >
                Clientes
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
              <Link
                to="/"
                className="inline-flex items-center justify-center text-blue-400 hover:text-blue-300 transition px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-blue-500/10"
                title="Volver al Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="ml-2 text-sm">Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">

        {/* Success Message */}
        {state === "success" && (
          <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-400">
                ¡Formulario enviado con éxito!
              </p>
              <p className="text-emerald-300/80 text-sm mt-1">
                Nos pondremos en contacto pronto para discutir tu proyecto
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {state === "error" && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400">Error al enviar</p>
              <p className="text-red-300/80 text-sm mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 sm:p-10 space-y-6"
        >
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
                placeholder="Tu empresa"
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
                placeholder="Tu nombre"
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
              placeholder="tu@email.com"
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

          {/* Row 4: Presupuesto Estimado */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Presupuesto Estimado CLP
            </label>
            <input
              type="number"
              name="presupuesto_estimado"
              value={formData.presupuesto_estimado}
              onChange={handleInputChange}
              placeholder="0"
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
              placeholder="Describe los objetivos principales de tu proyecto..."
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
              placeholder="Menciona sitios web competidores o similares que te inspiren..."
              rows={3}
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
              placeholder="Otros detalles o referencias que consideres importantes..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
            />
          </div>

          {/* Submit Button - Full Width CTA */}
          <button
            type="submit"
            disabled={state === "loading"}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 mt-8 min-h-[44px]"
          >
            {state === "loading" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              "Guardar Cliente"
            )}
          </button>
        </form>

          {/* Footer Note */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Tus datos serán tratados de forma confidencial
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
