import { useState, useEffect } from "react";

interface ProgressIndicatorProps {
  current: number;
  target: number;
  label: string;
  currency?: string;
  percentage?: number; // Optional: override calculated percentage
}

export default function ProgressIndicator({
  current,
  target,
  label,
  currency = "$",
  percentage: externalPercentage,
}: ProgressIndicatorProps) {
  const [displayCurrent, setDisplayCurrent] = useState(0);
  // Use external percentage if provided, otherwise calculate it
  const percentage = externalPercentage !== undefined ? externalPercentage : (current / target) * 100;
  const cappedPercentage = Math.min(percentage, 100); // Cap at 100% for SVG rendering
  const remaining = Math.max(target - current, 0);
  const isOverTarget = percentage > 100;

  // Animate counter on mount
  useEffect(() => {
    if (current === 0) {
      setDisplayCurrent(0);
      return;
    }

    let start = 0;
    const increment = current / 50;
    const timer = setInterval(() => {
      start += increment;
      if (start >= current) {
        setDisplayCurrent(current);
        clearInterval(timer);
      } else {
        setDisplayCurrent(Math.floor(start));
      }
    }, 10);

    return () => clearInterval(timer);
  }, [current]);

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (cappedPercentage / 100) * circumference;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8">
      <p className="text-gray-400 text-sm font-medium mb-6">{label}</p>

      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* Circular Progress */}
        <div className="relative w-40 h-40 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="hsl(var(--slate-700))"
              strokeWidth="3"
              fill="none"
              opacity="0.3"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="url(#gradient)"
              strokeWidth="3"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient
                id="gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={isOverTarget ? "rgb(250, 204, 21)" : "rgb(59, 130, 246)"} />
                <stop offset="100%" stopColor={isOverTarget ? "rgb(217, 119, 6)" : "rgb(37, 99, 235)"} />
              </linearGradient>
            </defs>
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${
              isOverTarget ? "text-yellow-400 animate-pulse" : "text-white"
            }`}>
              {Math.round(percentage)}%
            </span>
            <span className="text-xs text-gray-400 mt-1">Completado</span>
          </div>

          {/* Glow effect when over target */}
          {isOverTarget && (
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="rgb(250, 204, 21)"
              strokeWidth="2"
              fill="none"
              opacity="0.5"
              className="animate-pulse"
            />
          )}
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Ingresos Actuales</p>
            <p className="text-3xl font-bold text-white">
              {formatCurrency(displayCurrent)}
            </p>
          </div>
          <div className="h-px bg-slate-700/30"></div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Meta Mensual</p>
            <p className="text-2xl font-bold text-blue-400">
              {formatCurrency(target)}
            </p>
          </div>
          <div className="h-px bg-slate-700/30"></div>
          <div>
            <p className="text-gray-400 text-sm mb-1">Falta para la Meta</p>
            <p className={`text-2xl font-bold ${
              isOverTarget ? "text-emerald-400" : (remaining === 0 ? "text-emerald-400" : "text-orange-400")
            }`}>
              {isOverTarget
                ? "¡Objetivo Superado! 🌟"
                : (remaining === 0
                  ? "¡Meta alcanzada! 🎉"
                  : formatCurrency(remaining))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
