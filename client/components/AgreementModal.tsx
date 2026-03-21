import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import axios from "axios";
import { DEFAULT_TERMS } from "@/constants/terms";

interface AgreementModalProps {
  projectId: number;
  termsText: string;
  projectName: string;
  onAgreementAccepted: () => void;
}

export default function AgreementModal({
  projectId,
  termsText,
  projectName,
  onAgreementAccepted,
}: AgreementModalProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Validate content and provide fallback
  const displayTerms = termsText && termsText.trim() ? termsText : DEFAULT_TERMS;

  // Debug logging
  useEffect(() => {
    console.log("🔍 AgreementModal - Validación de Contenido:", {
      projectId,
      projectName,
      termsTextLength: termsText?.length || 0,
      termsTextEmpty: !termsText || termsText.trim() === "",
      isUsingFallback: !termsText || termsText.trim() === "",
      displayTermsLength: displayTerms.length,
      preview: displayTerms.substring(0, 100) + "...",
    });
  }, [projectId, projectName, termsText, displayTerms]);

  const handleAcceptAgreement = async () => {
    if (!isChecked) {
      setError("Debes aceptar los términos para continuar");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Send acceptance to backend
      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/aceptar_acuerdo.php",
        {
          proyecto_id: projectId,
        }
      );

      if (response.data.success) {
        // Trigger callback to refresh project data
        onAgreementAccepted();
      } else {
        setError(
          response.data.message ||
            "Error al registrar la aceptación del acuerdo"
        );
      }
    } catch (err) {
      console.error("Error accepting agreement:", err);
      setError("Error al procesar tu aceptación. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent closing with Esc key by capturing the event
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex flex-col"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreement-title"
    >
      {/* Modal Container - Flexbox layout for proper scrolling */}
      <div className="flex flex-col w-full h-full max-w-2xl mx-auto">
        {/* Header - Fixed at top */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600/20 to-slate-900 backdrop-blur border-b border-slate-700/50 p-4 md:p-6 flex-shrink-0">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 md:w-6 h-5 md:h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div className="min-w-0 flex-1">
              <h2
                id="agreement-title"
                className="text-lg md:text-2xl font-bold text-white mb-1"
              >
                Acuerdo de Proyecto y Presupuesto
              </h2>
              <p className="text-gray-400 text-xs md:text-sm break-words">
                Proyecto: <span className="font-semibold">{projectName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="p-4 md:p-8 space-y-4 md:space-y-6">
            {/* Terms Content */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 md:p-6">
              <div className="prose prose-invert max-w-none text-gray-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                {displayTerms}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs md:text-sm">{error}</p>
              </div>
            )}

            {/* Checkbox */}
            <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="w-5 h-5 mt-1 rounded border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  aria-label="Aceptar términos del acuerdo"
                />
                <span className="text-gray-300 text-xs md:text-sm">
                  He leído y{" "}
                  <span className="font-semibold">
                    acepto el Acuerdo de Proyecto y el Presupuesto
                  </span>{" "}
                  detallado arriba. Entiendo que proceder significa estar de
                  acuerdo con todos los términos especificados.
                </span>
              </label>
            </div>

            {/* Info Banner */}
            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 text-xs md:text-sm">
                ✓ Esta aceptación será registrada junto con tu fecha y dirección
                IP para mantener un registro de esta transacción.
              </p>
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom with action button */}
        <div className="sticky bottom-0 z-10 bg-slate-900 border-t border-slate-700/50 p-4 md:p-6 flex-shrink-0">
          <button
            onClick={handleAcceptAgreement}
            disabled={!isChecked || isSubmitting}
            className={`w-full py-3 md:py-4 px-4 md:px-6 rounded-lg font-semibold transition flex items-center justify-center gap-2 min-h-[44px] ${
              isChecked && !isSubmitting
                ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white cursor-pointer"
                : "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50"
            }`}
            type="button"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="text-sm md:text-base">Procesando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm md:text-base">Confirmar y Aceptar Acuerdo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
