import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import Logo from '@/components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🔵 handleSubmit fue LLAMADO');
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // Validation
    if (!formData.usuario.trim() || !formData.password.trim()) {
      console.warn('⚠️ Campos vacíos - no se envía la petición');
      setError('Por favor completa usuario y contraseña');
      setLoading(false);
      return;
    }

    try {
      // Build data object with exact keys expected by backend
      const dataToSend = {
        usuario: formData.usuario,
        password: formData.password,
      };

      // Log data before sending
      console.log('📤 Enviando login:', dataToSend);

      // Call backend authentication endpoint
      const response = await axios.post(
        'https://crm.claudiogonzalez.dev/api/auth_login.php',
        dataToSend,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📡 Response status:', response.status);
      console.log('📡 Response data:', response.data);

      if (!response.data.token) {
        console.warn('⚠️ Token no encontrado en respuesta');
        setError('Respuesta inválida del servidor: falta el token');
        setLoading(false);
        return;
      }

      // Extract rol and userId from user object (nested structure)
      const userRol = response.data.user?.rol || response.data.rol;
      const userId = response.data.user?.id || response.data.usuario_id || response.data.id;

      console.log('✅ Autenticación exitosa');
      console.log('📊 Datos del usuario:', { rol: userRol, usuario_id: userId });

      setSuccess(true);

      // Store token, rol, and userId and redirect
      login(response.data.token, userRol, userId ? parseInt(userId, 10) : undefined);

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('❌ Error durante la autenticación:', err);

      if (axios.isAxiosError(err)) {
        console.error('  Status:', err.response?.status);
        console.error('  Data:', err.response?.data);
        console.error('  Message:', err.message);
        setError(
          err.response?.data?.message ||
          'Error en la autenticación. Verifica tus credenciales.'
        );
      } else if (err instanceof Error) {
        setError('Error: ' + err.message);
      } else {
        setError('Error al conectar con el servidor. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header - Standardized Architecture */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 space-y-4 lg:space-y-0">
          {/* ROW 1: Logo (centered on mobile) */}
          <div className="flex items-center justify-center lg:justify-start">
            <Logo size="md" />
          </div>

          {/* ROW 2: Title */}
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-white text-center lg:text-left break-words">
              Gestión de Proyectos
            </h1>
            <p className="text-gray-400 text-xs lg:text-sm text-center lg:text-left break-words">
              Panel de Administración
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Inicia Sesión</h2>
            <p className="text-gray-400 text-sm mt-2">
              Ingresa tus credenciales para acceder al panel administrativo
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-emerald-400 text-sm">¡Autenticación exitosa! Redirigiendo...</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Usuario <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="usuario"
                value={formData.usuario}
                onChange={handleInputChange}
                placeholder="Ingresa tu usuario"
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
              />
            </div>

            {/* Password Field */}
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
                  placeholder="Ingresa tu contraseña"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-300 transition"
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Debug Toggle */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="showDebug"
                checked={showDebug}
                onChange={(e) => setShowDebug(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label
                htmlFor="showDebug"
                className="text-xs text-gray-400 cursor-pointer hover:text-gray-300"
              >
                Ver lo que se envía
              </label>
            </div>

            {/* Debug Data Display */}
            {showDebug && (
              <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
                <p className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-words">
                  {JSON.stringify(
                    {
                      usuario: formData.usuario || '(vacío)',
                      password: formData.password || '(vacío)',
                    },
                    null,
                    2
                  )}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="pt-4 border-t border-slate-700/50 text-center">
            <p className="text-gray-500 text-xs">
              Este es un panel privado. Solo acceso autenticado.
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
