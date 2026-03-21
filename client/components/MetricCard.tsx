import { ReactNode } from "react";

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  suffix?: string;
  description?: string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
}

export default function MetricCard({
  icon,
  label,
  value,
  suffix,
  description,
  trend,
}: MetricCardProps) {
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
          {icon}
        </div>
        {trend && (
          <div
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              trend.direction === "up"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
      {description && (
        <p className="text-gray-500 text-xs mb-3">{description}</p>
      )}
      <p className="text-3xl font-bold text-white">
        {value}
        {suffix && <span className="text-lg font-normal text-gray-400 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
