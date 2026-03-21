import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Filter, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ProjectsTable, { Project } from "@/components/ProjectsTable";
import UpcomingExpirations, { ExpirationProject } from "@/components/UpcomingExpirations";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";

type ProjectStatus =
  | "Cotización"
  | "En Desarrollo"
  | "Revisiones"
  | "Finalizado"
  | "Cobrado";

export default function ProjectsList() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>([]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const statuses: ProjectStatus[] = [
    "Cotización",
    "En Desarrollo",
    "Revisiones",
    "Finalizado",
    "Cobrado",
  ];

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Filter projects whenever projects or selected statuses change
  useEffect(() => {
    filterProjects();
  }, [projects, selectedStatuses]);

  const fetchProjects = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        "https://crm.claudiogonzalez.dev/api/get_proyectos.php"
      );

      // Handle both array and object response formats
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.proyectos || [];

      setProjects(data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al cargar proyectos"
          : "Error al cargar proyectos"
      );
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const filterProjects = () => {
    if (selectedStatuses.length === 0) {
      // If no filters selected, show all projects
      setFilteredProjects(projects);
    } else {
      // Filter by selected statuses
      const filtered = projects.filter((project) =>
        selectedStatuses.includes(project.estado)
      );
      setFilteredProjects(filtered);
    }
  };

  const toggleStatusFilter = (status: ProjectStatus) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      } else {
        return [...prev, status];
      }
    });
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
              Listado de Proyectos
            </h1>
            <p className="text-gray-400 text-xs break-words">
              Visualiza y administra todos tus proyectos
            </p>
          </div>

          {/* Desktop ROW (single line): Logo | Title | Actions */}
          <div className="hidden lg:flex lg:items-center lg:justify-between lg:flex-1 gap-6">
            <Logo size="md" />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1 break-words">
                Listado de Proyectos
              </h1>
              <p className="text-gray-400 text-sm break-words">
                Visualiza y administra todos tus proyectos
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Primary CTA Button - Full Width */}
        <Link
          to="/nuevo-proyecto"
          className="w-full mb-8 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          Nuevo Proyecto
        </Link>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start justify-between">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-200">Filtrar por Estado</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => toggleStatusFilter(status)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
                  selectedStatuses.includes(status)
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800/50 border border-slate-600/50 text-gray-300 hover:border-slate-500/50"
                }`}
              >
                {status}
              </button>
            ))}
            {selectedStatuses.length > 0 && (
              <button
                onClick={() => setSelectedStatuses([])}
                className="px-4 py-2 rounded-lg font-semibold text-sm bg-slate-800/50 border border-slate-600/50 text-gray-300 hover:border-slate-500/50 transition"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 text-sm text-gray-400">
          Mostrando{" "}
          <span className="font-semibold text-gray-200">
            {filteredProjects.length}
          </span>{" "}
          de <span className="font-semibold text-gray-200">{projects.length}</span>{" "}
          proyectos
          {selectedStatuses.length > 0 && (
            <>
              {" "}
              {selectedStatuses.length === 1
                ? `(${selectedStatuses[0]})`
                : `(${selectedStatuses.length} estados)`}
            </>
          )}
        </div>

        {/* Próximos Vencimientos */}
        {!loading && projects.length > 0 && (
          <UpcomingExpirations
            projects={projects as ExpirationProject[]}
            warningDays={90}
          />
        )}

        {/* Projects Table Container */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
          <ProjectsTable projects={filteredProjects} loading={loading} />
        </div>

        {/* Empty State Message */}
        {!loading && filteredProjects.length === 0 && projects.length > 0 && (
          <div className="mt-8 text-center p-8 bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl">
            <p className="text-gray-400 mb-4">
              No hay proyectos con los filtros seleccionados
            </p>
            <button
              onClick={() => setSelectedStatuses([])}
              className="px-4 py-2 text-blue-400 hover:text-blue-300 transition font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
