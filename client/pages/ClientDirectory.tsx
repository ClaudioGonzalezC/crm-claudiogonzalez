import { useState, useEffect } from "react";
import axios from "axios";
import { Search, Plus, LogOut, Settings, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ClientTable, { Client } from "@/components/ClientTable";
import EditClientModal from "@/components/EditClientModal";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";

export default function ClientDirectory() {
  const navigate = useNavigate();
  const { logout, rol } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [error, setError] = useState("");

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, []);

  // Filter clients based on search term
  useEffect(() => {
    const filtered = clients.filter((client) =>
      client.nombre_empresa.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClients(filtered);
  }, [clients, searchTerm]);

  const fetchClients = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(
        "https://crm.claudiogonzalez.dev/api/get_clientes.php"
      );
      // Handle both array and object response formats
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.clientes || [];

      setClients(data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al cargar clientes"
          : "Error al cargar clientes"
      );
      console.error("Error fetching clients:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        "¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      // Delete endpoint - adjust this to match your backend API
      await axios.post(
        "https://crm.claudiogonzalez.dev/api/eliminar_cliente.php",
        { id },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Remove from local state
      setClients((prev) => prev.filter((client) => client.id !== id));
    } catch (err) {
      const errorMsg = axios.isAxiosError(err)
        ? err.response?.data?.message || "Error al eliminar cliente"
        : "Error al eliminar cliente";
      setError(errorMsg);
    }
  };

  const handleRefresh = () => {
    fetchClients();
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
              Directorio de Clientes
            </h1>
            <p className="text-gray-400 text-xs break-words">
              Gestiona y edita la información de tus clientes
            </p>
          </div>

          {/* Desktop ROW (single line): Logo | Title | Actions */}
          <div className="hidden lg:flex lg:items-center lg:justify-between lg:flex-1 gap-6">
            <Logo size="md" />
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-1 break-words">
                Directorio de Clientes
              </h1>
              <p className="text-gray-400 text-sm break-words">
                Gestiona y edita la información de tus clientes
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
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Primary CTA Button - Full Width */}
        <Link
          to="/nuevo-cliente"
          className="w-full mb-8 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
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

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nombre de empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-800/50 transition font-semibold"
          >
            Actualizar
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 text-sm text-gray-400">
          Mostrando <span className="font-semibold text-gray-200">{filteredClients.length}</span> de{" "}
          <span className="font-semibold text-gray-200">{clients.length}</span> clientes
        </div>

        {/* Table Container */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
          <ClientTable
            clients={filteredClients}
            loading={loading}
            onEdit={setEditingClient}
            onDelete={handleDelete}
            rol={rol}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSuccess={fetchClients}
        />
      )}
      <Footer />
    </div>
  );
}
