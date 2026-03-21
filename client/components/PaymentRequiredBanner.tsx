import { CreditCard, X, Clock } from "lucide-react";
import { useState, useEffect } from "react";

interface PaymentRequiredBannerProps {
  requiredAmount: number;
  paidAmount: number;
  totalAmount: number;
  projectName: string;
  fechaAceptacion?: string;   // REGLA 6: para calcular horas restantes dentro del banner
}

export default function PaymentRequiredBanner({
  requiredAmount,
  paidAmount,
  totalAmount,
  projectName,
  fechaAceptacion,
}: PaymentRequiredBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [horasRestantes, setHorasRestantes] = useState<number | null>(null);

  // Calcular horas restantes de las 48h
  useEffect(() => {
    if (!fechaAceptacion) return;
    const deadline = new Date(fechaAceptacion).getTime() + 48 * 60 * 60 * 1000;
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setHorasRestantes(0); return; }
      setHorasRestantes(Math.ceil(diff / 3600000)); // horas enteras hacia arriba
    };
    tick();
    const id = setInterval(tick, 60000); // actualizar cada minuto (suficiente para el banner)
    return () => clearInterval(id);
  }, [fechaAceptacion]);

  const remainingRequired = requiredAmount - paidAmount;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="sticky top-0 md:relative z-40 md:z-auto bg-slate-950 border-2 border-amber-500/50 md:rounded-xl p-4 md:p-8 space-y-6 md:space-y-6 shadow-lg">
      {/* Header with Close Button */}
      <div className="flex items-start gap-3 md:gap-4">
        <CreditCard className="w-6 md:w-7 h-6 md:h-7 text-amber-400 flex-shrink-0 mt-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg md:text-2xl font-bold text-white mb-2 md:mb-3">
            Abono Inicial Requerido
          </h3>
          <p className="text-amber-100 text-sm md:text-base">
            Para proceder con el trabajo en <span className="font-semibold text-amber-200">"{projectName}"</span>, se requiere confirmar un abono inicial del 50% del presupuesto.
          </p>
          {/* REGLA 6: Línea de urgencia con horas restantes */}
          {horasRestantes !== null && horasRestantes > 0 && (
            <p className="flex items-center gap-2 mt-2 text-amber-300 text-sm font-semibold">
              <Clock className="w-4 h-4 flex-shrink-0" />
              ⏳ Reserva de cupo activa: quedan <span className="text-amber-200 font-bold">{horasRestantes} hora{horasRestantes !== 1 ? 's' : ''}</span> para confirmar tu abono
            </p>
          )}
          {horasRestantes === 0 && (
            <p className="flex items-center gap-2 mt-2 text-red-400 text-sm font-semibold">
              ⚠️ Plazo de 48h vencido — contacta para re-agendar
            </p>
          )}
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="flex-shrink-0 p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Cerrar banner de pago"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Payment Progress Section */}
      <div className="ml-0 md:ml-0 space-y-4 md:space-y-5">
        {/* Summary Cards - Responsive Grid */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <div className="bg-slate-900/60 border border-amber-500/30 rounded-lg p-3 md:p-4">
            <p className="text-white text-xs md:text-sm font-medium mb-1">Requerido</p>
            <p className="text-2xl md:text-3xl font-bold text-amber-400 truncate">
              {formatCurrency(requiredAmount).replace('$', '')}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-emerald-500/30 rounded-lg p-3 md:p-4">
            <p className="text-white text-xs md:text-sm font-medium mb-1">Pagado</p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400 truncate">
              {formatCurrency(paidAmount).replace('$', '')}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-orange-500/30 rounded-lg p-3 md:p-4">
            <p className="text-white text-xs md:text-sm font-medium mb-1">Pendiente</p>
            <p className="text-2xl md:text-3xl font-bold text-orange-400 truncate">
              {formatCurrency(remainingRequired).replace('$', '')}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 md:space-y-3">
          <div className="relative h-4 md:h-6 bg-slate-900/80 rounded-full overflow-hidden border border-orange-500/60">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500 ease-out shadow-lg shadow-orange-500/50"
              style={{
                width: `${Math.min((paidAmount / requiredAmount) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs md:text-sm text-amber-100 font-medium">
              {Math.round((paidAmount / requiredAmount) * 100)}% completado
            </p>
            <p className="text-sm md:text-base font-bold text-amber-300">
              {remainingRequired > 0 ? `Falta: ${formatCurrency(remainingRequired)}` : "✅ Completo"}
            </p>
          </div>
        </div>

        {/* Info Message */}
        <p className="text-sm md:text-base text-amber-100 pt-2 border-t border-amber-500/20">
          💡 Una vez recibido el abono, todas las secciones se desbloquerán automáticamente.
        </p>
      </div>
    </div>
  );
}
