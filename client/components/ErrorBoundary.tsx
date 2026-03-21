import React from "react";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("❌ ErrorBoundary caught an error:", error);
    console.error("Error Info:", errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.state.error ? (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-6"
            >
              <Home className="w-5 h-5" />
              Volver al Dashboard
            </Link>

            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 font-semibold">Error al Cargar la Página</p>
                <p className="text-red-300/80 text-sm mt-2 break-words font-mono">
                  {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <details className="mt-4 text-xs text-red-300/60">
                    <summary className="cursor-pointer hover:text-red-300">
                      Más detalles técnicos
                    </summary>
                    <pre className="mt-2 overflow-x-auto bg-slate-900/50 p-3 rounded border border-red-500/20 whitespace-pre-wrap break-words">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>

            <div className="mt-6 bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-2">💡 Soluciones:</h3>
              <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
                <li>Recarga la página (F5 o Ctrl+R)</li>
                <li>Limpia el caché del navegador (F12 → Aplicación → Caché)</li>
                <li>Verifica que el servidor esté disponible</li>
                <li>Vuelve al Dashboard y abre el proyecto nuevamente</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        this.props.fallback || (
          <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
            <p className="text-red-400">Error desconocido. Por favor recarga la página.</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
