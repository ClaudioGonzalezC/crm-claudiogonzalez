import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: 'https://crm.claudiogonzalez.dev/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Setup auth token interceptor
 * Reads token from localStorage and adds it to request headers
 */
export const setupAuthInterceptor = () => {
  apiClient.interceptors.request.use(
    (config: AxiosRequestConfig<any>) => {
      const token = localStorage.getItem('auth_token');
      
      if (token) {
        console.log('🔐 Añadiendo token a headers de API request');
        if (!config.headers) {
          config.headers = {};
        }
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log('⚠️ No hay token disponible para request');
      }
      
      return config;
    },
    (error) => {
      console.error('❌ Error en interceptor de request:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor for handling 401 errors
  apiClient.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        console.log('🚫 Token inválido o expirado (401), limpiando localStorage');
        localStorage.removeItem('auth_token');
        window.location.href = '/#/login';
      }
      return Promise.reject(error);
    }
  );
};
