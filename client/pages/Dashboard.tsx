import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  UserPlus,
  Users,
  Briefcase,
  FolderOpen,
  TrendingUp,
  Clock,
  DollarSign,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MetricCard from "@/components/MetricCard";
import ProgressIndicator from "@/components/ProgressIndicator";
import RecentProjectsGrid from "@/components/RecentProjectsGrid";
import UpcomingExpirations, { ExpirationProject } from "@/components/UpcomingExpirations";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";

interface DashboardConfig {
  meta_liquida_mensual?: number;
  valor_hora?: number;
  ingresos_mes?: number;
}

interface ProjectStats {
  total_ganado: number;
  ganado_liquido: number;
  total_pendiente: number;
  total_cotizado: number;
  restante_para_meta: number;
  porcentaje_meta: number;
  meta_liquida_mensual: number;
  proyectos_recientes: RecentProject[];
}

type ProjectStatus = string; // Now supports dynamic "Revisión N" states

interface RecentProject {
  id: number;
  nombre?: string;
  estado: ProjectStatus;
  monto_bruto?: number;
  monto_liquido?: number;
}

const DEFAULT_CONFIG: Required<DashboardConfig> = {
  meta_liquida_mensual: 2500000,
  valor_hora: 48735,
  ingresos_mes: 0,
};

const DEFAULT_STATS: ProjectStats = {
  total_ganado: 0,
  ganado_liquido: 0,
  total_pendiente: 0,
  total_cotizado: 0,
  restante_para_meta: 0,
  porcentaje_meta: 0,
  meta_liquida_mensual: 2500000,
  proyectos_recientes: [],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout, rol } = useAuth();

  const [config, setConfig] = useState<Required<DashboardConfig>>(
    DEFAULT_CONFIG
  );
  const [stats, setStats] = useState<ProjectStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const handleLogout = () => {
    console.log('👋 Ejecutando logout desde Dashboard');
    logout();
    navigate('/login');
  };

  // Month and Year filters - default to current month/year
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch configuration on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  // Fetch stats when month/year changes
  useEffect(() => {
    fetchStats(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(
        "https://crm.claudiogonzalez.dev/api/get_config.php"
      );

      const data = response.data;
      setConfig({
        meta_liquida_mensual:
          data.meta_liquida_mensual || DEFAULT_CONFIG.meta_liquida_mensual,
        valor_hora: data.valor_hora || DEFAULT_CONFIG.valor_hora,
        ingresos_mes: data.ingresos_mes || DEFAULT_CONFIG.ingresos_mes,
      });
    } catch (error) {
      console.error("Error fetching config:", error);
      // Use default values on error
      setConfig(DEFAULT_CONFIG);
    }
  };

  const fetchStats = async (mes?: number, anio?: number) => {
    setLoading(true);
    try {
      const timestamp = new Date().getTime();
      const month = mes ?? selectedMonth;
      const year = anio ?? selectedYear;
      const url = new URL("https://crm.claudiogonzalez.dev/api/get_proyectos_stats.php");
      url.searchParams.append("mes", month.toString());
      url.searchParams.append("anio", year.toString());
      url.searchParams.append("t", timestamp.toString());

      const response = await axios.get(url.toString());

      const data = response.data;

      // Sanitize recent projects
      const projectsData = Array.isArray(data.proyectos_recientes)
        ? data.proyectos_recientes
        : [];

      // Use project data directly from backend without any calculations
      // Fields come directly from database: monto_bruto and monto_liquido (calculated as monto_bruto - retencion_sii)
      const projectsWithPayments = projectsData.slice(0, 4).map((p: any) => ({
        id: p.id,
        nombre: p.nombre_proyecto || "",
        estado: (p.estado || "Cotización") as ProjectStatus,
        monto_bruto: parseFloat(p.monto_bruto) || 0,
        monto_liquido: parseFloat(p.monto_liquido) || 0,
        // Asset fields for UpcomingExpirations
        dominio_nombre:      p.dominio_nombre      ?? null,
        dominio_provider:    p.dominio_provider    ?? null,
        dominio_vencimiento: p.dominio_vencimiento ?? null,
        hosting_provider:    p.hosting_provider    ?? null,
        hosting_plan:        p.hosting_plan        ?? null,
        hosting_vencimiento: p.hosting_vencimiento ?? null,
      }));

      // Use backend values directly - no calculations applied
      const totalGanado = parseFloat(data.total_ganado) || 0;
      const ganadoLiquido = parseFloat(data.ganado_liquido) || 0;
      const totalPendiente = parseFloat(data.total_pendiente) || 0;
      const metaLiquidaMensual = parseFloat(data.meta_liquida_mensual) || DEFAULT_STATS.meta_liquida_mensual;

      // Progress towards meta uses ganado_liquido (already calculated in backend)
      const restante = Math.max(metaLiquidaMensual - ganadoLiquido, 0);
      const porcentajeMeta = metaLiquidaMensual > 0
        ? Math.round((ganadoLiquido / metaLiquidaMensual) * 100)
        : 0;

      setStats({
        total_ganado: totalGanado,
        ganado_liquido: ganadoLiquido,
        total_pendiente: totalPendiente,
        total_cotizado: parseFloat(data.total_cotizado) || 0,
        restante_para_meta: restante,
        porcentaje_meta: porcentajeMeta,
        meta_liquida_mensual: metaLiquidaMensual,
        proyectos_recientes: projectsWithPayments as any,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Use default values on error
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const formatted = new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
    // Lowercase the month name for consistency
    return formatted.replace(/^(\w+,\s+\d+\s+de\s+)(\w+)(\s+\d{4})$/, (_, p1, month, p3) => {
      return p1 + month.toLowerCase() + p3;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header - Responsive Mobile/Desktop Separation */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-40 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
          {/* Mobile ROW 1: Logo + Buttons (icons only) */}
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchConfig();
                  fetchStats(selectedMonth, selectedYear);
                }}
                className="inline-flex items-center justify-center text-gray-400 hover:text-gray-300 transition px-2 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800/50"
                title="Actualizar datos"
              >
                <span className="text-lg">↻</span>
              </button>
              <Link
                to="/ajustes"
                className="inline-flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition px-2 py-2 min-h-[44px] min-w-[44px]"
                title="Ajustes de perfil"
              >
                <Settings className="w-5 h-5" />
              </Link>
              {rol === 'admin' && (
                <Link
                  to="/equipo"
                  className="inline-flex items-center justify-center text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition px-2 py-2 min-h-[44px] min-w-[44px]"
                  title="Gestionar equipo"
                >
                  <Users className="w-5 h-5" />
                </Link>
              )}
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

          {/* Mobile ROW 2: Title + Date */}
          <div className="lg:hidden">
            <h1 className="text-xl font-bold text-white break-words">
              {getGreeting()}, Claudio
            </h1>
            <p className="text-gray-400 text-xs capitalize break-words">
              {formatDate(currentTime)}
            </p>
          </div>

          {/* Desktop ROW (single line): Logo | Title+Date | Actions */}
          <div className="hidden lg:flex lg:items-center lg:justify-between lg:flex-1 gap-6">
            <Logo size="md" />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white break-words">
                {getGreeting()}, Claudio
              </h1>
              <p className="text-gray-400 text-sm capitalize break-words">
                {formatDate(currentTime)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  fetchConfig();
                  fetchStats(selectedMonth, selectedYear);
                }}
                className="inline-flex items-center justify-center text-gray-400 hover:text-gray-300 transition px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-800/50"
                title="Actualizar datos"
              >
                <span className="text-lg">↻</span>
                <span className="ml-2 text-sm font-semibold">Actualizar</span>
              </button>
              <Link
                to="/ajustes"
                className="inline-flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition px-3 py-2 min-h-[44px] min-w-[44px]"
                title="Ajustes de perfil"
              >
                <Settings className="w-5 h-5" />
                <span className="ml-2 text-sm font-semibold">Ajustes</span>
              </Link>
              {rol === 'admin' && (
                <Link
                  to="/equipo"
                  className="inline-flex items-center justify-center text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition px-3 py-2 min-h-[44px] min-w-[44px]"
                  title="Gestionar equipo"
                >
                  <Users className="w-5 h-5" />
                  <span className="ml-2 text-sm font-semibold">Mi Equipo</span>
                </Link>
              )}
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
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {!loading && (
          <>
            {/* Month and Year Selectors */}
            <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Filtrar por Período</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Mes
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                  >
                    <option value={1}>Enero</option>
                    <option value={2}>Febrero</option>
                    <option value={3}>Marzo</option>
                    <option value={4}>Abril</option>
                    <option value={5}>Mayo</option>
                    <option value={6}>Junio</option>
                    <option value={7}>Julio</option>
                    <option value={8}>Agosto</option>
                    <option value={9}>Septiembre</option>
                    <option value={10}>Octubre</option>
                    <option value={11}>Noviembre</option>
                    <option value={12}>Diciembre</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Año
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition appearance-none cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    const today = new Date();
                    setSelectedMonth(today.getMonth() + 1);
                    setSelectedYear(today.getFullYear());
                  }}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 rounded-lg transition font-medium text-sm"
                >
                  Hoy
                </button>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                icon={<DollarSign className="w-6 h-6" />}
                label="Ingresos Líquidos Reales"
                value={formatCurrency(stats.ganado_liquido)}
                trend={
                  stats.ganado_liquido > 0
                    ? { value: 15, direction: "up" }
                    : undefined
                }
              />
              <MetricCard
                icon={<TrendingUp className="w-6 h-6" />}
                label="Proyectado (En Curso)"
                value={formatCurrency(stats.total_pendiente)}
                description="Incluye Desarrollo y Revisiones"
              />
              <MetricCard
                icon={<Clock className="w-6 h-6" />}
                label="Faltante para Meta"
                value={formatCurrency(Math.max(stats.restante_para_meta, 0))}
                trend={
                  stats.restante_para_meta <= 0
                    ? { value: 100, direction: "up" }
                    : undefined
                }
              />
            </div>

            {/* Main Content: Progress + Recent Projects */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Progress Indicator */}
              <div>
                <ProgressIndicator
                  current={stats.ganado_liquido}
                  target={stats.meta_liquida_mensual}
                  label="Progreso hacia la Meta Mensual"
                  currency="$"
                  percentage={stats.porcentaje_meta}
                />
              </div>

              {/* Right: Recent Projects Grid */}
              <div>
                {(() => {
                  const projectsList = stats.proyectos_recientes.map((p: any) => ({
                    id: p.id,
                    nombre: p.nombre,
                    estado: p.estado,
                    monto: p.monto_bruto || 0,
                    montoBruto: p.monto_bruto || 0,
                    montoLiquido: p.monto_liquido || 0,
                  }));

                  return <RecentProjectsGrid projects={projectsList} loading={loading} />;
                })()}
              </div>
            </div>

            {/* Próximos Vencimientos */}
            {(() => {
              const expProjects: ExpirationProject[] = stats.proyectos_recientes.map((p: any) => ({
                id: p.id,
                proyecto: p.nombre || "",
                cliente_nombre: "",
                dominio_nombre:      p.dominio_nombre      ?? null,
                dominio_provider:    p.dominio_provider    ?? null,
                dominio_vencimiento: p.dominio_vencimiento ?? null,
                hosting_provider:    p.hosting_provider    ?? null,
                hosting_plan:        p.hosting_plan        ?? null,
                hosting_vencimiento: p.hosting_vencimiento ?? null,
              }));
              return <UpcomingExpirations projects={expProjects} warningDays={90} />;
            })()}

            {/* Quick Actions */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">
                Acciones Rápidas
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                  to="/nuevo-cliente"
                  className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 hover:bg-slate-800/30 transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 group-hover:bg-blue-500/30 rounded-lg text-blue-400 transition">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Registrar Cliente
                      </h3>
                      <p className="text-sm text-gray-400">
                        Agregar nuevo cliente
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/clientes"
                  className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 hover:bg-slate-800/30 transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 group-hover:bg-blue-500/30 rounded-lg text-blue-400 transition">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Ver Directorio
                      </h3>
                      <p className="text-sm text-gray-400">
                        Gestionar clientes
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/nuevo-proyecto"
                  className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 hover:bg-slate-800/30 transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 group-hover:bg-blue-500/30 rounded-lg text-blue-400 transition">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Nuevo Proyecto
                      </h3>
                      <p className="text-sm text-gray-400">
                        Registrar proyecto
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/proyectos"
                  className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 hover:bg-slate-800/30 transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 group-hover:bg-blue-500/30 rounded-lg text-blue-400 transition">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Ver Proyectos
                      </h3>
                      <p className="text-sm text-gray-400">
                        Administrar todos
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Footer Info */}
            <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">
                Estadísticas actualizadas:{" "}
                <span className="text-blue-400 font-semibold">
                  {currentTime.toLocaleTimeString("es-CL")}
                </span>
                {" "} • Total proyectos cobrados: <span className="text-emerald-400 font-semibold">{stats.total_ganado > 0 ? "✓" : "—"}</span>
              </p>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
