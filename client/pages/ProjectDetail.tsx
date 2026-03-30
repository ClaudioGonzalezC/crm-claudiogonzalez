import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, AlertCircle, ArrowLeft, LogOut, Settings, Plus, Trash2, EyeOff, Eye, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_TERMS } from "@/constants/terms";
import ProjectStatusComponent from "@/components/ProjectStatus";
import NotesSection, { Note } from "@/components/NotesSection";
import RevisionCounter from "@/components/RevisionCounter";
import TotalCalculator from "@/components/TotalCalculator";
import PaymentManagement, { Payment } from "@/components/PaymentManagement";
import TimeTracking, { TimeEntry } from "@/components/TimeTracking";
import FileManagement from "@/components/FileManagement";
import AssetStatusCard from "@/components/AssetStatusCard";
import ClientShareUrl from "@/components/ClientShareUrl";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";
import WorkflowPanel from "@/components/WorkflowPanel";
import V2FlagsDisplay from "@/components/V2FlagsDisplay";
import BoletaManagement from "@/components/v2/BoletaManagement";
import ExpensesManagement from "@/components/v2/ExpensesManagement";
import ProjectEvalForm from "@/components/v2/ProjectEvalForm";
import EmotionalEvalForm from "@/components/v2/EmotionalEvalForm";
import QuoteBuilder from "@/components/v2/QuoteBuilder";
import ProfitabilityCalculator from "@/components/ProfitabilityCalculator";
import BillingPlanConfigurator from "@/components/v2/BillingPlanConfigurator";
import FinalizeClosePanel from "@/components/v2/FinalizeClosePanel";

type ProjectStatusType =
  | "Cotización"
  | "En Desarrollo"
  | "Revisiones"
  | "Finalizado"
  | "Cobrado";

interface CostoExtra {
  id: number;
  descripcion: string;
  monto_liquido: number;
  monto_bruto: number;
  fecha_registro: string;
  visible_cliente?: number | boolean;
}

interface ProjectData {
  id: number;
  nombre_proyecto: string;
  cliente_id: number;
  cliente_nombre?: string;
  horas_estimadas: number;
  valor_hora_acordado: number;
  revisiones_totales?: number;
  revisiones_incluidas?: number;
  revisiones_usadas?: number;
  estado: ProjectStatusType;
  share_token?: string;
  monto_bruto?: number;
  monto_liquido?: number;
  costos_extra?: CostoExtra[];
  monto_total_contrato?: number;
  base_boleta?: number;   // honor + ALL grossup → lo que se boletea ($1.023.599)
  abono_50?: number;      // base_boleta × 0.8475 × 0.5 → anticipo requerido ($433.750)
  dominio_nombre?: string;           // Asset Management: Domain name
  dominio_provider?: string;         // Asset Management: Domain provider
  dominio_vencimiento?: string;      // Asset Management: Domain expiration date
  hosting_provider?: string;         // Asset Management: Hosting provider
  hosting_plan?: string;             // Asset Management: Hosting plan
  hosting_vencimiento?: string;      // Asset Management: Hosting expiration date
  terminos_condiciones?: string;     // Agreement terms text
  terminos_aceptados?: number;       // 0 or 1 - whether client accepted
  fecha_aceptacion?: string;         // When client accepted (DATETIME)
  mostrar_seguimiento_tiempo?: boolean; // Control visibilidad tiempo en portal cliente

  // ── V2 scalar fields ──────────────────────────────────────────
  status_v2?:  string | null;
  closed_at?:  string | null;
  has_project_eval?: boolean;
  emotional_eval_completed?: boolean;
  profit_calculated?: boolean;
  cost_hour?: number | null;
  overhead_snapshot?: number | null;
  real_hours?: number | null;
  net_profit?: number | null;
  stress_score?: number | null;

  // ── V2 sections (populated by get_proyecto_detalle.php) ───────
  workflow?: V2Workflow | null;
  quote?: V2Quote | null;
  boletas_v2?: V2BoletasSection | null;
  expenses_v2?: V2ExpensesSection | null;
  project_eval?: V2ProjectEval | null;
  emotional_eval?: V2EmotionalEval | null;
  time_summary?: V2TimeSummary | null;
}

// ── V2 TYPE DEFINITIONS ────────────────────────────────────────────────────

interface V2Flags {
  has_project_eval: boolean;
  emotional_eval_completed: boolean;
  profit_calculated: boolean;
}

interface V2Workflow {
  status_v2:  string;
  is_closed:  boolean;
  closed_at:  string | null;
  flags:      V2Flags;
}

// quote_items: task_name is the real column name (not description)
interface V2QuoteItem {
  id: number;
  task_name: string;
  est_hours: number;
  hourly_rate: number;
  line_total: number;
}

// quotes: approved (bool) + approved_date; no status string; nullable numerics
interface V2Quote {
  id: number;
  version_num: number;
  approved: boolean;
  approved_date: string | null;
  created_at: string;
  subtotal: number | null;
  buffer_pct: number | null;
  projected_bruto: number | null;
  projected_liquido: number | null;
  items: V2QuoteItem[];
}

// boletas: numero_boleta (not folio), paid_date (not fecha_pago)
interface V2Boleta {
  id: number;
  numero_boleta: string | null;
  status: string;
  fecha_emision: string | null;
  monto_bruto: number;
  retencion_pct: number;
  monto_retencion: number;
  monto_liquido: number;
  tipo_cobro: string | null;
  paid_date: string | null;
  payment_method: string | null;
  f29_paid: boolean;
  created_at: string;
}

// boletas_v2: nested totals object (not flat); liquido_cobrado lives inside totals
interface V2BoletasTotals {
  total_bruto: number;
  total_retencion: number;
  total_liquido: number;
  liquido_cobrado: number;
  f29_pendientes: number;
}

interface V2BoletasSection {
  count: number;
  totals: V2BoletasTotals;
  list: V2Boleta[];
}

interface V2Expense {
  id: number;
  expense_name: string;
  amount: number;
  expense_date: string;
  category: string;
  notes: string | null;
  created_at: string;
}

interface V2ExpensesSection {
  count: number;
  total_expenses: number;
  list: V2Expense[];
}

// project_eval: answers include question text and type (joined from questions table)
interface V2EvalAnswer {
  question_id: number;
  question: string;
  type: string;
  answer_value: string;
  answer_notes: string | null;
}

interface V2ProjectEval {
  id: number;
  score: number;
  notes: string | null;
  created_at: string;
  answers: V2EvalAnswer[];
}

// emotional_eval: exact fields from emotional_evals table
interface V2EmotionalEval {
  satisfaction_score: number | null;
  stress_level: number | null;
  client_conflicts: boolean;
  would_repeat: boolean;
  learning_outcome: string | null;
  final_notes: string | null;
  created_at: string;
}

interface V2TimeSummary {
  total_hours: number;
  by_type: {
    billable_dev: number;
    meeting: number;
    non_billable_fix: number;
    admin: number;
  };
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { logout, rol } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  const [project, setProject] = useState<ProjectData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"pagos" | "documentos">("pagos");
  const [editingTerms, setEditingTerms] = useState(false);
  const [termsText, setTermsText] = useState("");
  const [termsSaving, setTermsSaving] = useState(false);
  // REGLA 7: Control visibilidad seguimiento de tiempo
  const [togglingTiempo, setTogglingTiempo] = useState(false);
  const isFetchingRef = useRef(false); // Guard against simultaneous requests

  // Early check: if no projectId, show error immediately
  if (!projectId && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al Dashboard
          </Link>
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold">Error</p>
              <p className="text-red-300/80 text-sm mt-1">
                No se especificó un ID de proyecto válido
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fetchProjectData = useCallback(async () => {
    // Prevent simultaneous API requests
    if (isFetchingRef.current) {
      console.warn("Fetch already in progress, skipping duplicate request");
      return;
    }
    isFetchingRef.current = true;

    setLoading(true);
    setError("");

    try {
      if (!projectId) {
        throw new Error("ID de proyecto no válido");
      }

      const projectNum = parseInt(projectId);
      console.log('🔢 Project ID parseado:', projectNum);

      // Fetch project details with cache buster (timestamp)
      const timestamp = new Date().getTime();
      const apiUrl = `https://crm.claudiogonzalez.dev/api/get_proyecto_detalle.php?id=${projectNum}&t=${timestamp}`;
      console.log('📡 Llamando a API:', apiUrl);

      const projectResponse = await axios.get(apiUrl);
      console.log('✅ API Response received:', projectResponse);
      console.log('✅ API Response data:', projectResponse.data);

      const rawProjectData = projectResponse.data;

      if (!rawProjectData || !rawProjectData.id) {
        throw new Error('Respuesta del API incompleta o inválida');
      }

      // Sanitize numeric fields - convert strings to numbers
      const costos = Array.isArray(rawProjectData.costos_extra)
        ? rawProjectData.costos_extra.map((c: any) => ({
            id: c.id,
            descripcion: c.descripcion,
            monto_liquido: parseFloat(c.monto_liquido) || 0,
            monto_bruto: parseFloat(c.monto_bruto) || 0,
            fecha_registro: c.fecha_registro || new Date().toISOString(),
            visible_cliente: c.visible_cliente === 1 || c.visible_cliente === true ? 1 : 0,
          }))
        : [];

      const projectData: ProjectData = {
        // Base fields
        id: rawProjectData.id,
        nombre_proyecto: rawProjectData.nombre_proyecto,
        cliente_id: rawProjectData.cliente_id,
        cliente_nombre: rawProjectData.cliente_nombre,
        horas_estimadas: parseFloat(rawProjectData.horas_estimadas) || 0,
        valor_hora_acordado: parseFloat(rawProjectData.valor_hora_acordado) || 0,
        revisiones_totales: parseInt(rawProjectData.revisiones_totales || rawProjectData.revisiones_incluidas || 0),
        revisiones_incluidas: parseInt(rawProjectData.revisiones_incluidas || 0),
        revisiones_usadas: parseInt(rawProjectData.revisiones_usadas) || 0,
        estado: rawProjectData.estado as ProjectStatusType,
        share_token: rawProjectData.share_token,
        monto_bruto: Math.round(parseFloat(rawProjectData.monto_bruto) || 0),
        monto_liquido: Math.round(parseFloat(rawProjectData.monto_liquido) || 0),
        costos_extra: costos,
        monto_total_contrato: Math.round(parseFloat(rawProjectData.monto_total_contrato) || parseFloat(rawProjectData.monto_bruto) || 0),
        base_boleta: Math.round(parseFloat(rawProjectData.base_boleta) || parseFloat(rawProjectData.monto_bruto) || 0),
        abono_50:    Math.round(parseFloat(rawProjectData.abono_50) || 0),

        // Asset Management fields - Domain (Dominio)
        dominio_nombre: rawProjectData.dominio_nombre || undefined,
        dominio_provider: rawProjectData.dominio_provider || undefined,
        dominio_vencimiento: rawProjectData.dominio_vencimiento || undefined,

        // Asset Management fields - Hosting
        hosting_provider: rawProjectData.hosting_provider || undefined,
        hosting_plan: rawProjectData.hosting_plan || undefined,
        hosting_vencimiento: rawProjectData.hosting_vencimiento || undefined,

        // Agreement fields
        terminos_condiciones: rawProjectData.terminos_condiciones || DEFAULT_TERMS,
        terminos_aceptados: parseInt(rawProjectData.terminos_aceptados) || 0,
        fecha_aceptacion: rawProjectData.fecha_aceptacion || undefined,
        mostrar_seguimiento_tiempo: rawProjectData.mostrar_seguimiento_tiempo !== undefined
          ? Boolean(rawProjectData.mostrar_seguimiento_tiempo)
          : true, // Default visible si la columna aún no existe en BD

        // ── V2 scalar fields ────────────────────────────────────
        status_v2: rawProjectData.status_v2 ?? null,
        has_project_eval:         Boolean(rawProjectData.has_project_eval),
        emotional_eval_completed: Boolean(rawProjectData.emotional_eval_completed),
        profit_calculated:        Boolean(rawProjectData.profit_calculated),
        cost_hour:         rawProjectData.cost_hour         != null ? parseFloat(rawProjectData.cost_hour)         || null : null,
        overhead_snapshot: rawProjectData.overhead_snapshot != null ? parseFloat(rawProjectData.overhead_snapshot) || null : null,
        real_hours:        rawProjectData.real_hours        != null ? parseFloat(rawProjectData.real_hours)        || null : null,
        net_profit:        rawProjectData.net_profit        != null ? parseFloat(rawProjectData.net_profit)        || null : null,
        stress_score:      rawProjectData.stress_score      != null ? parseFloat(rawProjectData.stress_score)      || null : null,

        // ── V2 sections (pass through as-is from API) ──────────
        workflow:       rawProjectData.workflow       ?? null,
        quote:          rawProjectData.quote          ?? null,
        boletas_v2:     rawProjectData.boletas_v2     ?? null,
        expenses_v2:    rawProjectData.expenses_v2    ?? null,
        project_eval:   rawProjectData.project_eval   ?? null,
        emotional_eval: rawProjectData.emotional_eval ?? null,
        time_summary:   rawProjectData.time_summary   ?? null,
      };

      console.log("Proyecto cargado (sanitizado):", projectData);
      console.log("DEBUG ASSETS - ProjectDetail:", {
        dominio_nombre: projectData.dominio_nombre,
        dominio_provider: projectData.dominio_provider,
        dominio_vencimiento: projectData.dominio_vencimiento,
        hosting_provider: projectData.hosting_provider,
        hosting_plan: projectData.hosting_plan,
        hosting_vencimiento: projectData.hosting_vencimiento,
      });

      // Ensure estado is properly defined
      if (!projectData.estado) {
        throw new Error("El proyecto no tiene estado definido");
      }

      setProject(projectData);
      setTermsText(projectData.terminos_condiciones || DEFAULT_TERMS);

      // Fetch notes with cache buster
      try {
        const notesResponse = await axios.get(
          `https://crm.claudiogonzalez.dev/api/gestionar_notas.php?proyecto_id=${projectNum}&accion=obtener&t=${timestamp}`
        );
        const notesData = Array.isArray(notesResponse.data)
          ? notesResponse.data
          : notesResponse.data.notas || [];
        setNotes(notesData);
      } catch (err) {
        console.error("Error fetching notes:", err);
      }

      // Fetch payments with cache buster
      try {
        const paymentsResponse = await axios.get(
          `https://crm.claudiogonzalez.dev/api/obtener_pagos.php?proyecto_id=${projectNum}&t=${timestamp}`
        );
        const paymentsData = Array.isArray(paymentsResponse.data)
          ? paymentsResponse.data
          : paymentsResponse.data.pagos || [];

        // Sanitize payment data - use fecha_pago from API
        const sanitizedPayments = paymentsData.map((p: any) => ({
          id: p.id,
          proyecto_id: p.proyecto_id,
          monto: parseFloat(p.monto) || 0,
          descripcion: p.descripcion || '',
          fecha: p.fecha_pago || p.fecha || '',
        }));

        console.log('💳 Pagos sanitizados en ProjectDetail:', sanitizedPayments);
        setPayments(sanitizedPayments);
      } catch (err) {
        console.error("Error fetching payments:", err);
      }

      // Fetch time entries with cache buster
      try {
        const entriesResponse = await axios.get(
          `https://crm.claudiogonzalez.dev/api/obtener_horas.php?proyecto_id=${projectNum}&t=${timestamp}`
        );
        const entriesData = Array.isArray(entriesResponse.data)
          ? entriesResponse.data
          : entriesResponse.data.horas || [];

        // Sanitize time entry data
        const sanitizedEntries = entriesData.map((e: any) => ({
          id: e.id,
          proyecto_id: e.proyecto_id,
          horas: parseFloat(e.horas) || 0,
          descripcion: e.descripcion,
          fecha: e.fecha,
        }));

        setTimeEntries(sanitizedEntries);
      } catch (err) {
        console.error("Error fetching time entries:", err);
      }
    } catch (err) {
      let errorMsg = "Error al cargar los datos del proyecto";

      console.error('❌ Error en fetchProjectData:', err);

      if (axios.isAxiosError(err)) {
        console.error('  Status:', err.response?.status);
        console.error('  Message:', err.response?.data?.message);
        console.error('  URL:', err.config?.url);

        if (err.response?.status === 404) {
          errorMsg = "Proyecto no encontrado (404)";
        } else if (err.response?.status === 500) {
          errorMsg = "Error del servidor al cargar el proyecto (500)";
        } else {
          errorMsg = err.response?.data?.message || "Error al cargar los datos del proyecto";
        }
      } else if (err instanceof Error) {
        console.error('  Error message:', err.message);
        errorMsg = err.message;
      }

      console.error('📋 Final error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
      isFetchingRef.current = false; // Always reset the flag
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);



  // ── REGLA 7: Toggle visibilidad seguimiento de tiempo ────────────────────
  const handleToggleMostrarTiempo = async (nuevoValor: boolean) => {
    if (!project || togglingTiempo) return;
    setTogglingTiempo(true);
    // Optimistic update — actualizar UI inmediatamente
    setProject(prev => prev ? { ...prev, mostrar_seguimiento_tiempo: nuevoValor } : null);
    try {
      await axios.post(
        "https://crm.claudiogonzalez.dev/api/actualizar_preferencias_proyecto.php",
        { proyecto_id: project.id, mostrar_seguimiento_tiempo: nuevoValor }
      );
    } catch (err) {
      // Revertir en caso de error
      console.error("Error al actualizar preferencia:", err);
      setProject(prev => prev ? { ...prev, mostrar_seguimiento_tiempo: !nuevoValor } : null);
    } finally {
      setTogglingTiempo(false);
    }
  };

  const handleSaveTerms = async () => {
    if (!project) return;

    setTermsSaving(true);
    try {
      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/guardar_terminos.php",
        {
          proyecto_id: project.id,
          terminos_condiciones: termsText,
        }
      );

      if (response.data.success) {
        setProject((prev) =>
          prev
            ? { ...prev, terminos_condiciones: termsText }
            : null
        );
        setEditingTerms(false);
      }
    } catch (err) {
      console.error("Error saving terms:", err);
    } finally {
      setTermsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 text-sm">Cargando proyecto {projectId}...</p>
        </div>
      </div>
    );
  }

  if (!project || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al Dashboard
          </Link>
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold">Error</p>
              <p className="text-red-300/80 text-sm mt-1">
                {error || "No se pudo cargar el proyecto"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── V2 detection — single source of truth for the entire render ──────────
  // Computed once at component scope; referenced by both rendering blocks.
  const isV2Project = !!project.workflow?.status_v2 || !!project.status_v2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-40 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-4 lg:py-6">
          {/* MOBILE: Two Rows */}
          <div className="lg:hidden space-y-4">
            {/* Mobile ROW 1: Logo + Action Buttons (icons only) */}
            <div className="flex items-center justify-between gap-4">
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

            {/* Mobile ROW 2: Title and Client Info (full width) */}
            <div>
              <h1 className="text-xl font-bold text-white mb-1 break-words">
                {project.nombre_proyecto}
              </h1>
              <p className="text-gray-400 text-xs break-words">
                {project.cliente_nombre || `Cliente ID: ${project.cliente_id}`}
              </p>
            </div>
          </div>

          {/* DESKTOP: One Row */}
          <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-6">
            {/* Desktop Left: Logo */}
            <div className="flex-shrink-0">
              <Logo size="md" />
            </div>

            {/* Desktop Center: Project Name + Client Name */}
            <div className="flex-1 lg:w-auto">
              <h1 className="text-3xl font-bold text-white mb-1 break-words">
                {project.nombre_proyecto}
              </h1>
              <p className="text-gray-400 text-sm break-words">
                {project.cliente_nombre || `Cliente ID: ${project.cliente_id}`}
              </p>
            </div>

            {/* Desktop Right: Action Buttons (with text labels) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                to="/"
                className="inline-flex items-center justify-center text-blue-400 hover:text-blue-300 transition px-3 py-2 min-h-[44px] rounded-lg hover:bg-blue-500/10"
                title="Volver al Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="ml-2 text-sm font-semibold">Dashboard</span>
              </Link>
              <Link
                to="/ajustes"
                className="inline-flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition px-3 py-2 min-h-[44px]"
                title="Ajustes de perfil"
              >
                <Settings className="w-5 h-5" />
                <span className="ml-2 text-sm font-semibold">Ajustes</span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition px-3 py-2 min-h-[44px]"
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
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Client Share URL */}
        {project?.share_token && (
          <ClientShareUrl
            shareToken={project.share_token}
            projectName={project?.nombre_proyecto || "Proyecto"}
          />
        )}

        {/* ── V2 block — isV2Project from component scope ──────────────── */}
        {(() => {
          // base_boleta = lo que se boletea; monto_total_contrato = deuda real (para saldo)
          const totalContrato = Math.round(project.base_boleta || project.monto_bruto || 0);
          const totalPaid = payments.reduce((sum, payment) => sum + payment.monto, 0);

          return (
            <>
              {/* Workflow V2 Panel — solo para proyectos V2 */}
              {isV2Project && (
                <WorkflowPanel
                  projectId={project.id}
                  workflow={project.workflow ?? null}
                  onTransitionSuccess={fetchProjectData}
                />
              )}

              {/* V2 Flags — solo para proyectos V2 */}
              {isV2Project && project.workflow?.flags && (
                <V2FlagsDisplay
                  flags={project.workflow.flags}
                  statusV2={project.workflow.status_v2}
                />
              )}

              {/* ── Plan de Cobro ─────────────────────────────────── */}
              {isV2Project && (
                <div className="mt-4">
                  <BillingPlanConfigurator projectId={project.id} />
                </div>
              )}

              {/* ── Evaluaciones (agrupadas) ──────────────────────── */}
              {isV2Project && (
                <div className="space-y-4 mt-6">
                  {/* Section label */}
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-gray-400 text-sm font-semibold shrink-0">
                      Evaluación del proyecto
                    </span>
                    <div className="flex-1 h-px bg-slate-700" />
                  </div>

                  {/* Pre-evaluación */}
                  <div className="space-y-1.5">
                    <p className="text-gray-600 text-xs px-1">
                      Pre-evaluación — antes de ejecutar
                    </p>
                    <ProjectEvalForm
                      projectId={project.id}
                      onDataChange={fetchProjectData}
                    />
                  </div>

                  {/* Evaluación emocional — gated by statusV2 inside the component */}
                  <div className="space-y-1.5">
                    <p className="text-gray-600 text-xs px-1">
                      Evaluación post-ejecución
                    </p>
                    <EmotionalEvalForm
                      projectId={project.id}
                      statusV2={project.workflow?.status_v2 ?? project.status_v2 ?? ""}
                      onDataChange={fetchProjectData}
                    />
                  </div>
                </div>
              )}

              {/* ── Cotización (QuoteBuilder) ─────────────────────── */}
              {isV2Project && (
                <div className="mt-6 mb-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 px-1">
                    Propuesta / Cotización
                  </p>
                  <div className="p-4 rounded-xl border border-slate-700/40 bg-slate-900/30">
                    <QuoteBuilder
                      projectId={project.id}
                      defaultRate={project.cost_hour ?? 0}
                      onDataChange={fetchProjectData}
                    />
                  </div>
                </div>
              )}

              {/* Estado legacy:
                  - Proyectos V2: muestra como badge informativo (isV2Mode=true)
                  - Proyectos legacy: panel completo con control de estado */}
              <ProjectStatusComponent
                projectId={project.id}
                currentStatus={project.estado}
                totalPaid={totalPaid}
                totalContract={totalContrato}
                totalRevisions={project.revisiones_totales ?? project.revisiones_incluidas ?? 0}
                revisionsUsed={project.revisiones_usadas || 0}
                onStatusChange={(newStatus) => {
                  setProject({ ...project, estado: newStatus as ProjectStatusType });
                }}
                onStatusChangeSuccess={fetchProjectData}
                isV2Mode={isV2Project}
              />

              {/* ── Finanzas (agrupadas) ───────────────────────────────── */}
              {isV2Project && (
                <div className="space-y-4 mt-6">
                  {/* Section label */}
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-gray-400 text-sm font-semibold shrink-0">
                      Finanzas del proyecto
                    </span>
                    <div className="flex-1 h-px bg-slate-700" />
                  </div>

                  <BoletaManagement
                    projectId={project.id}
                    initialData={project.boletas_v2 ?? null}
                    statusV2={project.workflow?.status_v2 ?? project.status_v2 ?? ""}
                    onDataChange={fetchProjectData}
                  />
                  <ExpensesManagement
                    projectId={project.id}
                    initialData={project.expenses_v2 ?? null}
                  />
                  <ProfitabilityCalculator
                    isV2Mode={true}
                    v2Data={{
                      profit_calculated: project.profit_calculated ?? false,
                      net_profit:        project.net_profit         ?? null,
                      real_hours:        project.real_hours          ?? null,
                      cost_hour:         project.cost_hour           ?? null,
                      overhead_snapshot: project.overhead_snapshot   ?? null,
                      liquidoCobrado:    project.boletas_v2?.totals?.liquido_cobrado ?? 0,
                      total_expenses:    project.expenses_v2?.total_expenses          ?? 0,
                      projectId:         project.id,
                    }}
                    onV2Calculated={fetchProjectData}
                  />
                </div>
              )}

              {/* ── Cierre formal ─────────────────────────────────────── */}
              {isV2Project && project.workflow?.flags && (
                <FinalizeClosePanel
                  projectId={project.id}
                  statusV2={project.workflow.status_v2}
                  flags={project.workflow.flags}
                  closedAt={project.workflow.closed_at ?? null}
                  onCloseSuccess={fetchProjectData}
                />
              )}
            </>
          );
        })()}

        {/* Asset Status Card - Domain and Hosting Management */}
        <AssetStatusCard
          dominio_nombre={project.dominio_nombre}
          dominio_provider={project.dominio_provider}
          dominio_vencimiento={project.dominio_vencimiento}
          hosting_provider={project.hosting_provider}
          hosting_plan={project.hosting_plan}
          hosting_vencimiento={project.hosting_vencimiento}
        />

        {/* Terms and Agreement Management */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-white">Acuerdo de Proyecto</h2>
            </div>
            {project.terminos_aceptados === 1 && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold">
                ✓ Aceptado por cliente
              </span>
            )}
          </div>

          {!editingTerms ? (
            <>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 max-h-96 overflow-y-auto mb-4">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {project.terminos_condiciones || DEFAULT_TERMS}
                </p>
              </div>
              <button
                onClick={() => setEditingTerms(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold text-sm"
              >
                Editar Términos
              </button>
            </>
          ) : (
            <>
              <textarea
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                className="w-full h-96 px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition font-mono text-sm resize-none"
                placeholder="Ingresa los términos del acuerdo..."
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSaveTerms}
                  disabled={termsSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition font-semibold text-sm flex items-center gap-2"
                >
                  {termsSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Guardando...
                    </>
                  ) : (
                    "Guardar Términos"
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditingTerms(false);
                    setTermsText(project.terminos_condiciones || DEFAULT_TERMS);
                  }}
                  disabled={termsSaving}
                  className="px-4 py-2 border border-slate-600/50 text-gray-300 hover:bg-slate-800/50 rounded-lg transition font-semibold text-sm"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}

          {project.terminos_aceptados === 1 && project.fecha_aceptacion && (
            <p className="text-gray-500 text-xs mt-4">
              Aceptado el {new Date(project.fecha_aceptacion).toLocaleDateString('es-CL')}
            </p>
          )}
        </div>

        {/* Revision Counter */}
        <RevisionCounter
          projectId={project.id}
          included={project.revisiones_totales ?? project.revisiones_incluidas ?? 0}
          used={project.revisiones_usadas || 0}
          projectStatus={project.estado}
          onUpdate={(newUsed) => {
            setProject({ ...project, revisiones_usadas: newUsed });
          }}
        />

        {/* REGLA 7: Toggle — Visibilidad Seguimiento de Tiempo en Portal Cliente */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">Seguimiento de Tiempo</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {project.mostrar_seguimiento_tiempo
                    ? "Visible en el portal del cliente"
                    : "Oculto en el portal del cliente"}
                </p>
              </div>
            </div>
            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => handleToggleMostrarTiempo(!project.mostrar_seguimiento_tiempo)}
              disabled={togglingTiempo}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                project.mostrar_seguimiento_tiempo ? "bg-blue-600" : "bg-slate-600"
              }`}
              aria-pressed={project.mostrar_seguimiento_tiempo}
              aria-label="Mostrar seguimiento de tiempo al cliente"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  project.mostrar_seguimiento_tiempo ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {/* Indicador de estado visual */}
          <div className={`mt-3 flex items-center gap-2 text-xs ${
            project.mostrar_seguimiento_tiempo ? "text-blue-400" : "text-gray-500"
          }`}>
            {project.mostrar_seguimiento_tiempo
              ? <><Eye className="w-3 h-3" /> El cliente puede ver las horas invertidas</>
              : <><EyeOff className="w-3 h-3" /> Las horas están ocultas para el cliente</>
            }
          </div>
        </div>

        {/* Notes Section */}
        <NotesSection
          projectId={project.id}
          notes={notes}
          onNotesUpdate={setNotes}
          rol={rol}
        />

        {/* Total Calculator + Costos Extra — legacy only, V2 uses ExpensesManagement */}
        {!isV2Project && (() => {
          // Calculate retencion_sii from bruto - liquido
          const montoBruto = Math.round(project.monto_bruto || 0);
          const montoLiquido = Math.round(project.monto_liquido || 0);
          const retencionSii = Math.round(montoBruto - montoLiquido);

          return (
            <TotalCalculator
              monto_bruto={montoBruto}
              retencion_sii={retencionSii}
              monto_liquido={montoLiquido}
              costos_extra={project.costos_extra || []}
              projectName={project.nombre_proyecto}
            />
          );
        })()}

        {/* Costos Extra - Visibility Indicator — legacy only */}
        {!isV2Project && project.costos_extra && project.costos_extra.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
              <h3 className="text-xl font-bold text-white">Costos Extra - Gestión de Visibilidad</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-400">Descripción</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-400">Monto Bruto</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-400">Visibilidad</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-400">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {project.costos_extra.map((costo) => {
                    const isHidden = costo.visible_cliente === 0 || costo.visible_cliente === false;
                    return (
                      <tr key={costo.id} className={`border-b border-slate-700/30 hover:bg-slate-800/30 transition ${isHidden ? 'opacity-70' : ''}`}>
                        <td className="px-4 py-3 text-gray-300">
                          <div className="flex items-center gap-2">
                            {isHidden && <EyeOff className="w-4 h-4 text-gray-500" />}
                            {costo.descripcion}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-cyan-400">
                          ${costo.monto_bruto?.toLocaleString('es-CL') || '0'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isHidden ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700/30 text-gray-400 text-xs rounded-full border border-gray-600/30">
                              <EyeOff className="w-3 h-3" />
                              Oculto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-700/30 text-blue-400 text-xs rounded-full border border-blue-600/30">
                              ✓ Visible
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">
                          {new Date(costo.fecha_registro).toLocaleDateString('es-CL')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-gray-500 text-xs mt-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
              💡 Los costos marcados como "Oculto" no aparecen en el portal del cliente. Todos los costos se incluyen en tu cálculo administrativo.
            </p>
          </div>
        )}

        {/* Calculate total contract using database value */}
        {(() => {
          // base_boleta = lo que se boletea; monto_total_contrato = deuda real (para saldo)
          const totalContrato = Math.round(project.base_boleta || project.monto_bruto || 0);
          // isV2Project from component scope (computed before return)

          return (
            <>
              {/* Tabs for Payment Management and File Management */}
              <div className="space-y-4">
                <div className="flex gap-2 border-b border-slate-700/50">
                  {/* Payment tab hidden for V2 projects — managed by BoletaManagement */}
                  {!isV2Project && (
                    <button
                      onClick={() => setActiveTab("pagos")}
                      className={`px-4 py-3 font-semibold text-sm transition border-b-2 ${
                        activeTab === "pagos"
                          ? "border-blue-500 text-blue-400"
                          : "border-transparent text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      Gestión de Pagos
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab("documentos")}
                    className={`px-4 py-3 font-semibold text-sm transition border-b-2 ${
                      activeTab === "documentos"
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent text-gray-400 hover:text-gray-300"
                    }`}
                  >
                    Archivos
                  </button>
                </div>

                {/* Tab Content: Payment Management — legacy only, never for V2 */}
                {!isV2Project && activeTab === "pagos" && (
                  <PaymentManagement
                    projectId={project.id}
                    payments={payments}
                    totalContract={totalContrato}
                    projectStatus={project.estado as ProjectStatusType}
                    onPaymentsUpdate={setPayments}
                    onStatusChange={(newStatus) => {
                      setProject({ ...project, estado: newStatus as ProjectStatusType });
                      fetchProjectData();
                    }}
                    onRefreshProject={fetchProjectData}
                    rol={rol}
                  />
                )}

                {/* Tab Content: File Management */}
                {activeTab === "documentos" && (
                  <FileManagement
                    projectId={project.id}
                    readOnly={false}
                    rol={rol}
                  />
                )}
              </div>

              {/* Time Tracking */}
              <TimeTracking
                projectId={project.id}
                estimatedHours={project.horas_estimadas}
                projectTotal={totalContrato}
                timeEntries={timeEntries}
                onTimeEntriesUpdate={setTimeEntries}
                onRegisterSuccess={fetchProjectData}
                rol={rol}
                isV2Mode={isV2Project}
                timeSummary={isV2Project ? (project.time_summary ?? null) : null}
              />
            </>
          );
        })()}
      </div>
      <Footer />
    </div>
  );
}
