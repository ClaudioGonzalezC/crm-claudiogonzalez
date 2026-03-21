import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  rol?: string;
  userId?: number;
  login: (token: string, rol?: string, userId?: number) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [rol, setRol] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('auth_token');
      const savedRol = localStorage.getItem('auth_rol');
      const savedUserId = localStorage.getItem('auth_user_id');

      if (savedToken) {
        setToken(savedToken);
        if (savedRol) {
          setRol(savedRol);
        }
        if (savedUserId) {
          setUserId(parseInt(savedUserId, 10));
        }
      }
    } catch (err) {
      console.error('Error al leer del localStorage:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newRol?: string, newUserId?: number) => {
    setToken(newToken);
    localStorage.setItem('auth_token', newToken);

    if (newRol) {
      setRol(newRol);
      localStorage.setItem('auth_rol', newRol);
    }

    if (newUserId) {
      setUserId(newUserId);
      localStorage.setItem('auth_user_id', newUserId.toString());
    }
  };

  const logout = () => {
    setToken(null);
    setRol(undefined);
    setUserId(undefined);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_rol');
    localStorage.removeItem('auth_user_id');
  };

  const value: AuthContextType = {
    isAuthenticated: token !== null,
    token,
    rol,
    userId,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
