import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/services/apiClient';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ArrowLeft, Lock, User, LogOut, Plus, Trash2, Edit2 } from 'lucide-react';

interface FormData {
  nombre: string;
  usuario: string;
  passwordActual: string;
  passwordNueva: string;
  passwordConfirm: string;
}

interface FormErrors {
  nombre?: string;
  usuario?: string;
  passwordActual?: string;
  passwordNueva?: string;
  passwordConfirm?: string;
  general?: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { logout, userId } = useAuth();
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    usuario: '',
    passwordActual: '',
    passwordNueva: '',
    passwordConfirm: '',
  });

  // Fetch current user data
  useEffect(() => {
    if (!userId) {
      console.warn('⚠️ userId no disponible en AuthContext');
      setLoadingProfile(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        console.log(`📂 Obteniendo datos del usuario: ${userId}`);
        const response = await apiClient.post(
          `https://crm.claudiogonzalez.dev/api/usuarios_gestion.php`,
          { operacion: 'obtener', usuario_id: userId }
        );

        console.log('✅ Datos del usuario obtenidos:', response.data);

        if (response.data) {
          setFormData((prev) => ({
            ...prev,
            nombre: response.data.nombre || '',
            usuario: response.data.usuario || '',
          }));
        }
      } catch (err) {
        console.error('❌ Error al obtener datos del usuario:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const [showPasswords, setShowPasswords] = useState({
    actual: false,
    nueva: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.usuario.trim()) {
      newErrors.usuario = 'El usuario es requerido';
    }

    // Only validate password fields if changing password
    if (changingPassword) {
      if (!formData.passwordActual.trim()) {
        newErrors.passwordActual = 'Debes ingresar tu contraseña actual';
      }

      if (!formData.passwordNueva.trim()) {
        newErrors.passwordNueva = 'Ingresa la nueva contraseña';
      } else if (formData.passwordNueva.length < 6) {
        newErrors.passwordNueva = 'La contraseña debe tener al menos 6 caracteres';
      }

      if (!formData.passwordConfirm.trim()) {
        newErrors.passwordConfirm = 'Confirma la nueva contraseña';
      } else if (formData.passwordNueva !== formData.passwordConfirm) {
        newErrors.passwordConfirm = 'Las contraseñas no coinciden';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSuccess(false);
    setErrors({});

    try {
      // Build data object - only include password fields if changing password
      const dataToSend: any = {
        usuario_id: userId,
        nombre: formData.nombre,
        usuario: formData.usuario,
      };

      // Only add password fields if user is changing password
      if (changingPassword) {
        dataToSend.passwordActual = formData.passwordActual;
        dataToSend.passwordNueva = formData.passwordNueva;
      }

      console.log('📤 Enviando actualización de perfil a actualizar_perfil.php:', dataToSend);

      const response = await apiClient.post(
        'https://crm.claudiogonzalez.dev/api/actualizar_perfil.php',
        dataToSend
      );

      console.log('✅ Perfil actualizado:', response.data);

      setSuccess(true);
      // Clear password fields after success
      setFormData((prev) => ({
        ...prev,
        passwordActual: '',
        passwordNueva: '',
        passwordConfirm: '',
      }));
      setChangingPassword(false);

      // Show success message for 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('❌ Error al actualizar perfil:', err);
      if (axios.isAxiosError(err)) {
        console.error('  Status:', err.response?.status);
        console.error('  Data:', err.response?.data);

        // Handle 401 - Wrong password
        if (err.response?.status === 401) {
          setErrors({
            passwordActual: 'Contraseña actual incorrecta. Intenta de nuevo.',
          });
        }
        // Handle specific errors from backend
        else if (err.response?.data?.errors) {
          setErrors(err.response.data.errors);
        } else {
          setErrors({
            general:
              err.response?.data?.message ||
              'Error al actualizar el perfil. Intenta de nuevo.',
          });
        }
      } else {
        setErrors({
          general: 'Error al conectar con el servidor.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('👋 Cerrando sesión desde Settings');
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-4"
              >
                <ArrowLeft className="w-5 h-5" />
                Volver al Dashboard
              </Link>
              <h1 className="text-4xl font-bold text-white">Ajustes de Perfil</h1>
              <p className="text-gray-400 mt-2">Gestiona tu información personal y seguridad</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition font-semibold text-sm flex items-center gap-2"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
        {/* Settings Card */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
          {/* Loading Profile */}
          {loadingProfile && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
              <p className="text-blue-400 text-sm">Cargando datos del perfil...</p>
            </div>
          )}
          {/* Success Message */}
          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-emerald-400 font-semibold">¡Perfil actualizado!</p>
                <p className="text-emerald-300/80 text-sm mt-1">
                  Tus cambios se han guardado correctamente.
                </p>
              </div>
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Settings Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section: Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Información Personal</h2>
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre Completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  placeholder="Tu nombre completo"
                  disabled={loading}
                  className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${
                    errors.nombre
                      ? 'border-red-500/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                      : 'border-slate-600/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                {errors.nombre && (
                  <p className="text-red-400 text-xs mt-1">{errors.nombre}</p>
                )}
              </div>

              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Usuario <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="usuario"
                  value={formData.usuario}
                  onChange={handleInputChange}
                  placeholder="Tu nombre de usuario"
                  disabled={loading}
                  className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${
                    errors.usuario
                      ? 'border-red-500/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                      : 'border-slate-600/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                {errors.usuario && (
                  <p className="text-red-400 text-xs mt-1">{errors.usuario}</p>
                )}
              </div>
            </div>

            {/* Section: Security */}
            <div className="space-y-4 pt-6 border-t border-slate-700/50">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-bold text-white">Seguridad</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setChangingPassword(!changingPassword)}
                  className="px-3 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition"
                >
                  {changingPassword ? 'Cancelar cambio' : 'Cambiar contraseña'}
                </button>
              </div>

              {/* Password Fields - Only show when toggled */}
              {changingPassword && (
                <div className="space-y-4 bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Contraseña Actual <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.actual ? 'text' : 'password'}
                        name="passwordActual"
                        value={formData.passwordActual}
                        onChange={handleInputChange}
                        placeholder="Ingresa tu contraseña actual"
                        disabled={loading}
                        className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${
                          errors.passwordActual
                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                            : 'border-slate-600/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((prev) => ({ ...prev, actual: !prev.actual }))}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-300 transition"
                      >
                        {showPasswords.actual ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.passwordActual && (
                      <p className="text-red-400 text-xs mt-1">{errors.passwordActual}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nueva Contraseña <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.nueva ? 'text' : 'password'}
                        name="passwordNueva"
                        value={formData.passwordNueva}
                        onChange={handleInputChange}
                        placeholder="Ingresa la nueva contraseña"
                        disabled={loading}
                        className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${
                          errors.passwordNueva
                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                            : 'border-slate-600/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((prev) => ({ ...prev, nueva: !prev.nueva }))}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-300 transition"
                      >
                        {showPasswords.nueva ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.passwordNueva && (
                      <p className="text-red-400 text-xs mt-1">{errors.passwordNueva}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirmar Nueva Contraseña <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        name="passwordConfirm"
                        value={formData.passwordConfirm}
                        onChange={handleInputChange}
                        placeholder="Confirma la nueva contraseña"
                        disabled={loading}
                        className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none transition disabled:opacity-50 ${
                          errors.passwordConfirm
                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20'
                            : 'border-slate-600/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-300 transition"
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.passwordConfirm && (
                      <p className="text-red-400 text-xs mt-1">{errors.passwordConfirm}</p>
                    )}
                  </div>

                  {/* Security Info */}
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded p-3 text-xs text-gray-400">
                    <p>🔒 <strong>Seguridad:</strong> Tu contraseña será encriptada antes de guardarse.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando cambios...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <p className="text-gray-400 text-sm">
            <strong>💡 Nota:</strong> Todos los cambios se guardan de forma segura. Si cambias tu contraseña, deberás ingresar con la nueva en tu próximo login.
          </p>
        </div>
      </div>
    </div>
  );
}
