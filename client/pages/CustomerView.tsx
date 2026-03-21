import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { AlertCircle, Home, Calendar, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { safeFormatDate, safeFormatCurrency } from "@/utils/dateFormatter";
import { DEFAULT_TERMS } from "@/constants/terms";
import TimeTrackingReadOnly from "@/components/TimeTrackingReadOnly";
import PaymentManagementReadOnly from "@/components/PaymentManagementReadOnly";
import RevisionCounterReadOnly from "@/components/RevisionCounterReadOnly";
import FileManagement from "@/components/FileManagement";
import AssetStatusCard from "@/components/AssetStatusCard";
import AgreementModal from "@/components/AgreementModal";
import LockedContentWrapper from "@/components/LockedContentWrapper";
import PaymentRequiredBanner from "@/components/PaymentRequiredBanner";
import CustomerViewSkeleton from "@/components/CustomerViewSkeleton";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";

type ProjectStatusType =
  | "Cotización"
  | "En Desarrollo"
  | "Revisiones"
  | "Finalizado"
  | "Cobrado";

interface TimeEntry {
  id: number;
  proyecto_id: number;
  horas: number;
  descripcion: string;
  fecha: string;
}

interface Payment {
  id: number;
  proyecto_id: number;
  monto: number;
  descripcion: string;
  fecha: string;
}

interface ExtraCost {
  id: number;
  descripcion: string;
  monto: number;                  // Valor bruto a cobrar
  fecha: string;
  visible_cliente?: number | boolean;  // 1/true = visible, 0/false = hidden
}

interface Note {
  id: number;
  proyecto_id: number;
  nota: string;
  fecha: string;
  creado_por: string;
}

interface ProjectData {
  id: number;
  nombre_proyecto: string;
  cliente_nombre?: string;
  horas_estimadas: number;
  valor_hora_acordado: number;
  estado: ProjectStatusType;
  revisiones_totales?: number;
  revisiones_incluidas?: number;
  revisiones_usadas: number;
  monto_bruto?: number;              // Monto bruto de honorarios
  monto_liquido?: number;            // Monto líquido de honorarios
  total_gastos_brutos?: number;      // Suma de gastos reembolsables visibles (bruto)
  monto_total_contrato?: number;     // Deuda REAL: honorarios + TODOS los gastos (visible o no)
  base_boleta?: number;              // Honor + ALL grossup → lo que se boletea ($1.023.599)
  abono_50?: number;                 // base_boleta × 0.8475 × 0.5 → anticipo ($433.750)
  total_pagado?: number;             // SUM(pagos_proyectos.monto) desde backend
  saldo_pendiente?: number;          // monto_total_contrato - total_pagado desde backend
  dominio_nombre?: string;           // Asset Management: Domain name
  dominio_provider?: string;         // Asset Management: Domain provider
  dominio_vencimiento?: string;      // Asset Management: Domain expiration date
  hosting_provider?: string;         // Asset Management: Hosting provider
  hosting_plan?: string;             // Asset Management: Hosting plan
  hosting_vencimiento?: string;      // Asset Management: Hosting expiration date
  terminos_condiciones?: string;     // Agreement terms text
  terminos_aceptados?: number;       // 0 or 1 - whether client accepted
  fecha_aceptacion?: string;         // When client accepted (DATETIME)
  mostrar_seguimiento_tiempo?: boolean; // Control visibilidad tiempo en portal
}

export default function CustomerView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [extras, setExtras] = useState<ExtraCost[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAdminToken, setHasAdminToken] = useState(false);
  const [agreementJustAccepted, setAgreementJustAccepted] = useState(false);
  // REGLA 6: Reloj 48h
  const [countdownDisplay, setCountdownDisplay] = useState<string | null>(null);
  const [paymentDeadlineExpired, setPaymentDeadlineExpired] = useState(false);
  const isFetchingRef = useRef(false);

  // Check if admin token exists (deferred, after loading)
  useEffect(() => {
    if (!loading && !error) {
      const adminToken = localStorage.getItem('auth_token');
      setHasAdminToken(!!adminToken);
    }
  }, [loading, error]);

  // REGLA 6: Contador regresivo 48h desde firma del acuerdo
  useEffect(() => {
    if (!project || project.terminos_aceptados !== 1 || !project.fecha_aceptacion) return;
    const totalPaid    = payments.reduce((sum, p) => sum + p.monto, 0);
    const required50   = project.abono_50 || Math.round((project.base_boleta || 0) * 0.8475 * 0.5);
    if (totalPaid >= required50) {
      setCountdownDisplay(null);
      setPaymentDeadlineExpired(false);
      return;
    }
    const deadline = new Date(project.fecha_aceptacion).getTime() + 48 * 60 * 60 * 1000;
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) {
        setPaymentDeadlineExpired(true);
        setCountdownDisplay(null);
        return;
      }
      setPaymentDeadlineExpired(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdownDisplay(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [project, payments]);

  const fetchProjectData = useCallback(async () => {
    // Early exit if no shareToken (public link token, not admin auth)
    if (!shareToken) {
      console.error('❌ Portal: Token de acceso inválido');
      setError("Token de acceso inválido o no proporcionado");
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    setLoading(true);
    setError("");

    try {
      // Cache-buster: Añadir timestamp para evitar respuestas cacheadas
      const timestamp = new Date().getTime();
      const projectUrl = `https://crm.claudiogonzalez.dev/api/get_proyecto_publico.php?token=${shareToken}&t=${timestamp}`;

      // Fetch project data
      const projectResponse = await axios.get(projectUrl);

      const data = projectResponse.data;

      if (!data || !data.proyecto) {
        throw new Error('Respuesta del API incompleta: falta data.proyecto');
      }

      // Sanitize project data - NUEVA ESTRUCTURA (REGLA DE ORO)
      const projectData: ProjectData = {
        // Base fields
        id: data.proyecto.id,
        nombre_proyecto: data.proyecto.nombre_proyecto,
        cliente_nombre: data.proyecto.cliente_nombre,
        horas_estimadas: parseFloat(data.proyecto.horas_estimadas) || 0,
        valor_hora_acordado: parseFloat(data.proyecto.valor_hora_acordado) || 0,
        estado: data.proyecto.estado as ProjectStatusType,
        revisiones_totales: parseInt(data.proyecto.revisiones_totales || data.proyecto.revisiones_incluidas || 0),
        revisiones_incluidas: parseInt(data.proyecto.revisiones_incluidas || 0),
        revisiones_usadas: parseInt(data.proyecto.revisiones_usadas) || 0,
        monto_bruto: Math.round(parseFloat(data.proyecto.monto_bruto) || 0),
        monto_liquido: Math.round(parseFloat(data.proyecto.monto_liquido) || 0),
        total_gastos_brutos: Math.round(parseFloat(data.proyecto.total_gastos_brutos) || 0),
        // REGLA DE ORO: backend calcula honorarios + gastos visible_cliente=1
        monto_total_contrato: Math.round(parseFloat(data.proyecto.monto_total_contrato) || 0),
        base_boleta: Math.round(parseFloat(data.proyecto.base_boleta) || parseFloat(data.proyecto.monto_bruto) || 0),
        abono_50:    Math.round(parseFloat(data.proyecto.abono_50) || 0),
        total_pagado: Math.round(parseFloat(data.proyecto.total_pagado) || 0),
        saldo_pendiente: Math.round(parseFloat(data.proyecto.saldo_pendiente) || 0),

        // Asset Management fields - Domain (Dominio)
        dominio_nombre: data.proyecto.dominio_nombre || undefined,
        dominio_provider: data.proyecto.dominio_provider || undefined,
        dominio_vencimiento: data.proyecto.dominio_vencimiento || undefined,

        // Asset Management fields - Hosting
        hosting_provider: data.proyecto.hosting_provider || undefined,
        hosting_plan: data.proyecto.hosting_plan || undefined,
        hosting_vencimiento: data.proyecto.hosting_vencimiento || undefined,

        // Agreement fields
        terminos_condiciones: data.proyecto.terminos_condiciones || DEFAULT_TERMS,
        terminos_aceptados: parseInt(data.proyecto.terminos_aceptados) || 0,
        fecha_aceptacion: data.proyecto.fecha_aceptacion || undefined,
        mostrar_seguimiento_tiempo: data.proyecto.mostrar_seguimiento_tiempo !== undefined
          ? Boolean(data.proyecto.mostrar_seguimiento_tiempo)
          : true, // Default visible — fallback seguro antes de correr la migración SQL
      };

      // DEBUG: Log backend response fields for auditing
      console.log('🔍 CustomerView Fetch DEBUG:', {
        monto_bruto_from_api: data.proyecto.monto_bruto,
        total_gastos_brutos_from_api: data.proyecto.total_gastos_brutos,
        monto_total_contrato_from_api: data.proyecto.monto_total_contrato,
        sanitized_projectData: projectData,
      });

      // DEBUG ASSETS - CustomerView
      console.log("DEBUG ASSETS - CustomerView:", {
        dominio_nombre: projectData.dominio_nombre,
        dominio_provider: projectData.dominio_provider,
        dominio_vencimiento: projectData.dominio_vencimiento,
        hosting_provider: projectData.hosting_provider,
        hosting_plan: projectData.hosting_plan,
        hosting_vencimiento: projectData.hosting_vencimiento,
      });

      // DEBUG AGREEMENT - CustomerView
      console.log("🔍 DEBUG AGREEMENT - CustomerView:", {
        from_api: data.proyecto.terminos_condiciones || "(empty/null)",
        from_api_length: data.proyecto.terminos_condiciones?.length || 0,
        terminos_aceptados: projectData.terminos_aceptados,
        fecha_aceptacion: projectData.fecha_aceptacion,
        fallback_used: !data.proyecto.terminos_condiciones,
        display_length: projectData.terminos_condiciones.length,
        preview: projectData.terminos_condiciones.substring(0, 100) + "...",
      });

      // Sanitize time entries
      const entriesData = Array.isArray(data.bitacora) ? data.bitacora : [];
      const sanitizedEntries = entriesData.map((e: any) => ({
        id: e.id,
        proyecto_id: e.proyecto_id,
        horas: parseFloat(e.horas) || 0,
        descripcion: e.descripcion,
        fecha: e.fecha,
      }));

      // Sanitize payments (descripcion may come from descripcion or nota field)
      const paymentsData = Array.isArray(data.pagos) ? data.pagos : [];
      const sanitizedPayments = paymentsData.map((p: any) => ({
        id: p.id,
        proyecto_id: p.proyecto_id,
        monto: parseFloat(p.monto) || 0,
        descripcion: p.descripcion || p.nota || '',
        fecha: p.fecha_pago || p.fecha || '',
      }));

      // Sanitize extra costs - array `extras` contiene {id, descripcion, monto (bruto), fecha, visible_cliente}
      const extrasData = Array.isArray(data.extras) ? data.extras : [];
      const sanitizedExtras = extrasData.map((e: any) => ({
        id: e.id,
        descripcion: e.descripcion,
        monto: Math.round(parseFloat(e.monto) || 0),  // Monto bruto a cobrar
        fecha: e.fecha || new Date().toISOString(),
        visible_cliente: e.visible_cliente === 1 || e.visible_cliente === true ? 1 : 0,  // Filtrado en frontend
      }));

      // Fetch notes in parallel while processing project data
      let sanitizedNotes: Note[] = [];
      try {
        const notesUrl = `https://crm.claudiogonzalez.dev/api/gestionar_notas.php?proyecto_id=${projectData.id}&accion=obtener&t=${timestamp}`;
        const notesRes = await axios.get(notesUrl);

        const notesData = Array.isArray(notesRes.data)
          ? notesRes.data
          : notesRes.data?.notas && Array.isArray(notesRes.data.notas)
            ? notesRes.data.notas
            : [];

        sanitizedNotes = notesData.map((n: any) => ({
          id: n.id,
          proyecto_id: n.proyecto_id,
          nota: n.nota || n.descripcion || '',
          fecha: n.fecha || n.fecha_creacion || new Date().toISOString(),
          creado_por: n.creado_por || 'Sistema',
        }));
      } catch (notesErr) {
        // Notes are optional, continue without them
        sanitizedNotes = [];
      }

      // Update ALL state at once - single batch update for best performance
      setProject(projectData);
      setTimeEntries(sanitizedEntries);
      setPayments(sanitizedPayments);
      setExtras(sanitizedExtras);
      setNotes(sanitizedNotes);
    } catch (err) {
      let errorMsg = "Error al cargar el proyecto";

      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          errorMsg = "Proyecto no encontrado. Verifica el token.";
        } else if (err.response?.status === 403) {
          errorMsg = "Acceso denegado. Token inválido o expirado.";
        } else if (err.response?.data?.message) {
          errorMsg = err.response.data.message;
        } else {
          errorMsg = `Error ${err.response?.status || "desconocido"}`;
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [shareToken]);

  // Setup initial fetch and polling every 5 minutes
  useEffect(() => {
    fetchProjectData();

    // Auto-refresh every 5 minutes (300000 ms) to keep data in sync
    const pollingInterval = setInterval(() => {
      fetchProjectData();
    }, 300000);

    // Cleanup: stop polling when component unmounts
    return () => {
      clearInterval(pollingInterval);
    };
  }, [fetchProjectData]);

  // Filter extras to only show visible ones for client portal
  const visibleExtras = useMemo(() => {
    return extras.filter((extra) => extra.visible_cliente === 1 || extra.visible_cliente === true);
  }, [extras]);

  // ========== MEMOIZED FINANCIAL CALCULATIONS ==========
  // VERDAD ÚNICA: monto_total_contrato del backend = honorarios + TODOS los gastos
  // (sin importar visible_cliente). El desglose visual usa visibleExtras, pero el
  // total a cobrar y el cálculo del 50% siempre usan monto_total_contrato completo.
  const financialData = useMemo(() => {
    if (!project) return null;

    const estimatedHours = Math.max(parseFloat(String(project?.horas_estimadas || 0)) || 0, 0);
    const hourlyRate     = Math.max(parseFloat(String(project?.valor_hora_acordado || 0)) || 0, 0);

    // base_boleta = lo que se boletea y muestra al cliente como total a pagar
    const totalBruto = Math.round(project.base_boleta || project.monto_bruto || 0);

    const totalPaid = (Array.isArray(payments) ? payments : []).reduce(
      (sum, p) => sum + (Math.max(parseFloat(String(p?.monto || 0)) || 0, 0)), 0
    );
    const totalPaidRounded = Math.max(Math.round(totalPaid), 0);
    const pendingBalance   = Math.max(totalBruto - totalPaidRounded, 0);

    return {
      estimatedHours,
      hourlyRate,
      totalBruto,        // = monto_total_contrato (todos los gastos)
      totalPaid,
      totalPaidRounded,
      pendingBalance,
      paymentPercentage: totalBruto > 0
        ? ((totalPaidRounded / totalBruto) * 100).toFixed(1)
        : '0',
    };
  }, [project, payments]);

  // Show skeleton while loading
  if (loading) {
    return <CustomerViewSkeleton />;
  }

  if (!project || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-6"
          >
            <Home className="w-5 h-5" />
            Volver
          </Link>
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold">Error de Acceso</p>
              <p className="text-red-300/80 text-sm mt-1">
                {error || "No se pudo cargar el proyecto. Verifica el enlace de acceso."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use memoized financial data
  const {
    estimatedHours,
    totalBruto,
    totalPaidRounded,
    pendingBalance,
    paymentPercentage,
  } = financialData || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-emerald-600/20 backdrop-blur border-b border-slate-700/50 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4 lg:py-8 space-y-4 lg:space-y-0">
          {/* ROW 1 (Mobile/All): Logo + Action Buttons */}
          <div className="flex items-center justify-between gap-4">
            <Logo size="md" />

            {/* Action Buttons */}
            {hasAdminToken && (
              <Link
                to={`/proyecto/${project.id}`}
                className="px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 hover:text-white rounded-lg transition font-semibold text-xs lg:text-sm min-h-[44px] flex items-center gap-2"
                title="Acceder como administrador"
              >
                <span className="hidden lg:inline">Ver como Admin</span>
                <span className="lg:hidden">→</span>
              </Link>
            )}
          </div>

          {/* ROW 2 (Mobile/All): Title and Info Section */}
          <div className="flex-1">
            <p className="text-blue-400 text-xs lg:text-sm font-medium mb-2">
              Portal de Seguimiento
            </p>
            <h1 className="text-xl lg:text-4xl font-bold text-white mb-2 break-words">
              {project.nombre_proyecto}
            </h1>
            <p className="text-gray-400 text-xs lg:text-sm break-words">
              Cliente: <span className="text-gray-300 font-semibold">{project.cliente_nombre}</span>
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-500 text-sm">Estado del Proyecto:</span>
            <span
              className={`px-4 py-2 rounded-full font-semibold text-sm ${
                project.estado === "Finalizado"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : project.estado === "Cobrado"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : project.estado === "Revisiones"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : project.estado === "En Desarrollo"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
              }`}
            >
              {project.estado}
            </span>
          </div>
        </div>
      </div>

      {/* Agreement Modal - Blocks content if not accepted */}
      {project && project.terminos_aceptados === 0 && (
        <AgreementModal
          projectId={project.id}
          termsText={project.terminos_condiciones || ""}
          projectName={project.nombre_proyecto}
          onAgreementAccepted={() => {
            setAgreementJustAccepted(true);
            // Refresh project data to update terminos_aceptados
            setTimeout(() => fetchProjectData(), 1000);
          }}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Payment Required Banner - Show if agreement accepted but payment < 50% */}
        {project && project.terminos_aceptados === 1 && (() => {
          const totalRequired = project.abono_50 || Math.round((project.base_boleta || 0) * 0.8475 * 0.5);
          const totalPaid = payments.reduce((sum, p) => sum + p.monto, 0);
          if (totalPaid < totalRequired) {
            return (
              <PaymentRequiredBanner
                requiredAmount={Math.round(totalRequired)}
                paidAmount={Math.round(totalPaid)}
                totalAmount={Math.round(project.base_boleta || project.monto_total_contrato || 0)}
                projectName={project.nombre_proyecto}
                fechaAceptacion={project.fecha_aceptacion}
              />
            );
          }
          return null;
        })()}

        {/* REGLA 6: Reloj 48h — solo si firmó, no pagó el 50% y el plazo está activo o vencido */}
        {project && project.terminos_aceptados === 1 && (() => {
          const totalRequired = project.abono_50 || Math.round((project.base_boleta || 0) * 0.8475 * 0.5);
          const totalPaid = payments.reduce((sum, p) => sum + p.monto, 0);
          if (totalPaid >= totalRequired) return null;

          if (paymentDeadlineExpired) {
            return (
              <div className="flex items-start gap-4 px-5 py-4 bg-red-500/10 border-2 border-red-500/40 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-bold text-base mb-1">⚠️ Plazo de reserva vencido</p>
                  <p className="text-red-400/80 text-sm">
                    El período de 48 horas para confirmar el abono ha expirado. Contacta al profesional para re-agendar el inicio de tu proyecto.
                  </p>
                </div>
              </div>
            );
          }

          if (countdownDisplay) {
            return (
              <div className="flex items-start gap-4 px-5 py-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl">
                <Clock className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <p className="text-amber-300 font-bold text-base mb-1">
                    ⏳ Reserva de cupo activa: quedan <span className="font-mono text-amber-200 text-lg">{countdownDisplay}</span> horas para confirmar tu abono
                  </p>
                  <p className="text-amber-400/70 text-sm mb-3">
                    Confirma el 50% del presupuesto antes de que expire el plazo para asegurar tu fecha de inicio.
                  </p>
                  {/* Barra de tiempo consumido */}
                  <div className="w-full bg-amber-900/30 rounded-full h-2 overflow-hidden border border-amber-700/30">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000"
                      style={{
                        width: project.fecha_aceptacion
                          ? `${Math.min(((Date.now() - new Date(project.fecha_aceptacion).getTime()) / (48 * 3600000)) * 100, 100)}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* PERMANENT AGREEMENT SECTION - Always visible for client reference */}
        {project && project.terminos_aceptados === 1 && (
          <div className="bg-slate-950 border-2 border-blue-500/40 rounded-2xl p-4 md:p-8 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-400 rounded-full"></div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Acuerdo del Proyecto</h2>
            </div>

            {/* Terms Content - Scrollable on mobile */}
            <div className="bg-slate-900/60 border border-blue-500/20 rounded-xl p-4 md:p-6 max-h-80 overflow-y-auto">
              <p className="text-gray-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-mono">
                {project.terminos_condiciones || DEFAULT_TERMS}
              </p>
            </div>

            {/* Meta Info */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2 border-t border-blue-500/20">
              <div>
                <p className="text-gray-400 text-xs md:text-sm">
                  Aceptado el {new Date(project.fecha_aceptacion || new Date()).toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-semibold">
                ✓ Aceptado
              </span>
            </div>
          </div>
        )}

        {/* Time Tracking - Read Only — solo visible si el admin lo habilitó */}
        {project.mostrar_seguimiento_tiempo !== false && (
          <TimeTrackingReadOnly
            estimatedHours={project.horas_estimadas}
            timeEntries={timeEntries}
          />
        )}

        {/* Revision Counter - Read Only */}
        <RevisionCounterReadOnly
          included={project.revisiones_totales ?? project.revisiones_incluidas ?? 0}
          used={project.revisiones_usadas}
        />

        {/* Payment Management - Read Only */}
        <PaymentManagementReadOnly
          payments={payments}
          totalContract={project?.base_boleta || project?.monto_bruto || 0}
        />

        {/* Asset Status Card - Domain and Hosting Management */}
        {project && (() => {
          const totalRequired = project.abono_50 || Math.round((project.base_boleta || 0) * 0.8475 * 0.5);
          const totalPaid = payments.reduce((sum, p) => sum + p.monto, 0);
          const isLocked = project.terminos_aceptados === 1 && totalPaid < totalRequired;

          return (
            <LockedContentWrapper
              isLocked={isLocked}
              lockedMessage="Este contenido estará disponible después de confirmar tu abono"
            >
              <AssetStatusCard
                dominio_nombre={project.dominio_nombre}
                dominio_provider={project.dominio_provider}
                dominio_vencimiento={project.dominio_vencimiento}
                hosting_provider={project.hosting_provider}
                hosting_plan={project.hosting_plan}
                hosting_vencimiento={project.hosting_vencimiento}
              />
            </LockedContentWrapper>
          );
        })()}

        {/* File Management - Read Only */}
        {project && (() => {
          const totalRequired = project.abono_50 || Math.round((project.base_boleta || 0) * 0.8475 * 0.5);
          const totalPaid = payments.reduce((sum, p) => sum + p.monto, 0);
          const isLocked = project.terminos_aceptados === 1 && totalPaid < totalRequired;

          return (
            <LockedContentWrapper
              isLocked={isLocked}
              lockedMessage="Los archivos estarán disponibles después de confirmar tu abono"
            >
              <FileManagement
                projectId={project.id}
                readOnly={true}
              />
            </LockedContentWrapper>
          );
        })()}

        {/* Investment Summary Section - Simplified for Client */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8">
          {/* Header with Key Info - REGLA DE ORO */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">Resumen de Inversión</h2>
            </div>

            {/* Desglose de Costos — simplificado: una sola fila con el total real */}
            <div className="space-y-3 mb-6">
              {/* Total del Proyecto (honorarios + todos los gastos) */}
              <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/30">
                <p className="text-gray-400 text-sm">Honorarios Profesionales</p>
                <p className="text-xl font-bold text-blue-400">
                  {safeFormatCurrency(financialData?.totalBruto || 0, 'es-CL')}
                </p>
              </div>
            </div>

            {/* Total Final — usa monto_total_contrato (todos los gastos, visibles y no) */}
            <div className="p-6 bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 rounded-lg border border-emerald-500/30">
              <p className="text-gray-400 text-sm mb-2">Total Final a Pagar</p>
              <p className="text-4xl font-bold text-emerald-400">{safeFormatCurrency(financialData?.totalBruto || 0, 'es-CL')}</p>
            </div>
          </div>

          {/* Tabla de Gastos Operacionales - solo visibles para cliente */}
          {visibleExtras.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Desglose de Gastos Operacionales</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-400">Descripción</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-400">Monto a Cobrar</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-400">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleExtras.map((gasto) => (
                      <tr key={gasto.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 text-gray-300">{gasto.descripcion}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-400">
                          {safeFormatCurrency(gasto.monto, 'es-CL')}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">
                          {safeFormatDate(gasto.fecha, { includeTime: false })}
                        </td>
                      </tr>
                    ))}
                    {/* Total Gastos */}
                    <tr className="border-t-2 border-slate-700/50 bg-slate-800/50">
                      <td className="px-4 py-3 font-semibold text-gray-300">Subtotal Gastos</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-400 text-base">
                        {safeFormatCurrency(visibleExtras.reduce((sum, g) => sum + g.monto, 0), 'es-CL')}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Simple Payment Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Total Paid */}
            <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-2">Total Pagado a la Fecha</p>
              <p className="text-3xl font-bold text-blue-400">
                {safeFormatCurrency(Math.max(totalPaidRounded || 0, 0), 'es-CL')}
              </p>
              <p className="text-gray-500 text-xs mt-3">
                {payments.length || 0} pago{(payments.length || 0) !== 1 ? 's' : ''} registrado{(payments.length || 0) !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Pending Balance */}
            <div className="bg-slate-800/50 border border-orange-500/20 rounded-xl p-6">
              <p className="text-gray-400 text-sm mb-2">Saldo Pendiente</p>
              <p className={`text-3xl font-bold ${pendingBalance! > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                {safeFormatCurrency(Math.max(pendingBalance || 0, 0), 'es-CL')}
              </p>
              <p className="text-gray-500 text-xs mt-3">
                {pendingBalance! > 0
                  ? 'Pendiente de pago'
                  : (project?.base_boleta || 0) > 0 ? 'Proyecto completamente pagado ✓' : 'Sin datos'}
              </p>
            </div>
          </div>

          {/* Payment Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-400 text-sm">Progreso de Pagos</p>
              <p className="text-gray-300 text-sm font-semibold">
                {financialData?.paymentPercentage || 0}%
              </p>
            </div>
            <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden border border-slate-600/50">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(parseFloat(financialData?.paymentPercentage || '0'), 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Tracking Notes / Bitácora */}
        {notes.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-bold text-white">Bitácora de Seguimiento</h2>
            </div>

            {/* Timeline */}
            <div className="space-y-6">
              {notes
                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                .map((note, index) => (
                  <div key={note.id} className="flex gap-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-400 mt-2" />
                      {index < notes.length - 1 && (
                        <div className="w-0.5 h-12 bg-slate-700/30 mt-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-gray-300 font-semibold">{note.nota}</p>
                        <p className="text-gray-500 text-sm whitespace-nowrap">
                          {safeFormatDate(note.fecha, { includeTime: false })}
                        </p>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">Por: {note.creado_por}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">
            Este es un portal de seguimiento privado. Para hacer cambios o comunicarte directamente,
            <br />
            contacta al profesional responsable del proyecto.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
