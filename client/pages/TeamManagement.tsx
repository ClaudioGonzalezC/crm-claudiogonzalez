import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';

interface TeamMember {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
  fecha_creacion?: string;
}

interface FormData {
  nombre: string;
  usuario: string;
  password: string;
  rol: 'admin' | 'colaborador';
}

interface EditFormData {
  rol: 'admin' | 'colaborador';
  password: string;
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const { rol } = useAuth();

  // Redirect if not admin
  useEffect(() => {
    if (rol && rol !== 'admin') {
      console.warn('❌ Acceso denegado: Solo administradores pueden ver Mi Equipo');
      navigate('/');
    }
  }, [rol, navigate]);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    usuario: '',
    password: '',
    rol: 'colaborador',
  });

  const [editFormData, setEditFormData] = useState<EditFormData>({
    rol: 'colaborador',
    password: '',
  });

  // Fetch team members
  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('📂 Obteniendo equipo de trabajo...');
      const response = await apiClient.post(
        'https://crm.claudiogonzalez.dev/api/usuarios_gestion.php',
        { operacion: 'listar' }
      );

      console.log('✅ Equipo obtenido:', response.data);

      const users = Array.isArray(response.data) ? response.data : response.data.usuarios || [];
      setTeam(users);
    } catch (err) {
      console.error('❌ Error al obtener equipo:', err);
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
          'Error al cargar el equipo. Intenta de nuevo.'
        );
      } else {
        setError('Error al conectar con el servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    if (!formData.nombre.trim() || !formData.usuario.trim() || !formData.password.trim()) {
      setError('Completa todos los campos');
      setSubmitting(false);
      return;
    }

    try {
      console.log('📤 Creando usuario:', formData.usuario);

      const response = await apiClient.post(
        'https://crm.claudiogonzalez.dev/api/usuarios_gestion.php',
        { operacion: 'crear', ...formData }
      );

      console.log('✅ Usuario creado:', response.data);

      setSuccess(`✅ Usuario "${formData.usuario}" creado exitosamente`);
      setFormData({
        nombre: '',
        usuario: '',
        password: '',
        rol: 'colaborador',
      });
      setShowCreateForm(false);

      // Refresh team list
      await fetchTeam();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('❌ Error al crear usuario:', err);
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
          'Error al crear el usuario. Intenta de nuevo.'
        );
      } else {
        setError('Error al conectar con el servidor.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent, userId: number) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const dataToSend: any = {
      operacion: 'editar',
      usuario_id: parseInt(String(userId), 10),
      rol: editFormData.rol,
    };

    // Only include password if a new one was provided
    if (editFormData.password && editFormData.password.trim()) {
      dataToSend.password = editFormData.password;
    }

    try {
      console.log('📤 Actualizando usuario:', userId, 'Datos:', dataToSend);

      const response = await apiClient.post(
        'https://crm.claudiogonzalez.dev/api/usuarios_gestion.php',
        dataToSend
      );

      console.log('✅ Usuario actualizado:', response.data);

      setSuccess('✅ Usuario actualizado exitosamente');
      setEditingUser(null);
      setEditFormData({ rol: 'colaborador', password: '' });

      // Refresh team list
      await fetchTeam();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('❌ Error al actualizar usuario:', err);
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
          'Error al actualizar el usuario. Intenta de nuevo.'
        );
      } else {
        setError('Error al conectar con el servidor.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      console.log('🗑️ Eliminando usuario:', userId);

      const response = await apiClient.post(
        'https://crm.claudiogonzalez.dev/api/usuarios_gestion.php',
        { operacion: 'eliminar', usuario_id: parseInt(String(userId), 10) }
      );

      console.log('✅ Usuario eliminado:', response.data);

      setSuccess('✅ Usuario eliminado exitosamente');
      setDeletingId(null);

      // Refresh team list
      await fetchTeam();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('❌ Error al eliminar usuario:', err);
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
          'Error al eliminar el usuario. Intenta de nuevo.'
        );
      } else {
        setError('Error al conectar con el servidor.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-4"
              >
                <ArrowLeft className="w-5 h-5" />
                Volver al Dashboard
              </Link>
              <h1 className="text-4xl font-bold text-white">Mi Equipo</h1>
              <p className="text-gray-400 mt-2">Gestiona colaboradores y permisos</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Agregar Usuario</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-400 text-sm">{success}</p>
          </div>
        )}

        {/* Create User Form */}
        {showCreateForm && (
          <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 mb-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Crear Nuevo Usuario</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre Completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    placeholder="Nombre del colaborador"
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Usuario <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="usuario"
                    value={formData.usuario}
                    onChange={handleInputChange}
                    placeholder="nombre_usuario"
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contraseña <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Contraseña segura"
                      disabled={submitting}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 text-gray-400 hover:text-gray-300 transition"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rol <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="rol"
                    value={formData.rol}
                    onChange={handleInputChange}
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                  >
                    <option value="colaborador">Colaborador (sin borrar)</option>
                    <option value="admin">Administrador (total acceso)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Usuario'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-400 hover:text-gray-300 border border-slate-600/50 rounded-lg transition disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Team Members List */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : team.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400">No hay usuarios en el equipo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                      Nombre
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                      Usuario
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                      Rol
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {team.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-800/30 transition"
                    >
                      <td className="px-6 py-4 text-sm text-white">
                        {member.nombre}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {member.usuario}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            member.rol === 'admin'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {member.rol === 'admin'
                            ? 'Administrador'
                            : 'Colaborador'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(member);
                              setEditFormData({
                                rol: member.rol as 'admin' | 'colaborador',
                                password: '',
                              });
                            }}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded transition"
                            title="Editar usuario"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingId(member.id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded transition"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                Editar Usuario: {editingUser.nombre}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-300 transition"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => handleEditUser(e, editingUser.id)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rol <span className="text-red-400">*</span>
                </label>
                <select
                  name="rol"
                  value={editFormData.rol}
                  onChange={handleEditInputChange}
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                >
                  <option value="colaborador">Colaborador (sin borrar)</option>
                  <option value="admin">Administrador (total acceso)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nueva Contraseña (opcional)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    name="password"
                    value={editFormData.password}
                    onChange={handleEditInputChange}
                    placeholder="Dejar vacío para no cambiar"
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-300 transition"
                  >
                    {showEditPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={submitting}
                  className="px-4 py-2 text-gray-400 hover:text-gray-300 border border-slate-600/50 rounded-lg transition disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">Eliminar Usuario</h3>
            <p className="text-gray-400">
              ¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => handleDeleteUser(deletingId)}
                disabled={submitting}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  'Sí, Eliminar'
                )}
              </button>
              <button
                onClick={() => setDeletingId(null)}
                disabled={submitting}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 border border-slate-600/50 rounded-lg transition disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
