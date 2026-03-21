import RecentProjectCard from "./RecentProjectCard";
import { Loader2 } from "lucide-react";

type ProjectStatus = string; // Now supports dynamic "Revisión N" states

interface Project {
  id: number;
  nombre: string;
  estado: ProjectStatus;
  monto: number;
  montoBruto?: number;
  montoLiquido?: number;
  totalPagado?: number;        // Para calcular % de abono
  fechaAceptacion?: string;   // Para badge 48h
}

interface RecentProjectsGridProps {
  projects: Project[];
  loading?: boolean;
}

export default function RecentProjectsGrid({
  projects,
  loading = false,
}: RecentProjectsGridProps) {
  // Ensure we always have 4 items (fill with placeholders)
  const displayProjects = [...projects].slice(0, 4);
  while (displayProjects.length < 4) {
    displayProjects.push({
      id: Math.random(),
      nombre: "",
      estado: "Cotización",
      monto: 0,
    });
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Proyectos Recientes</h3>
      
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-slate-800/30 rounded-xl p-4 min-h-24 flex items-center justify-center"
            >
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {displayProjects.map((project, index) => (
            <RecentProjectCard
              key={project.id || `placeholder-${index}`}
              id={project.id}
              nombre={project.nombre}
              estado={project.estado}
              monto={project.monto}
              montoBruto={project.montoBruto}
              montoLiquido={project.montoLiquido}
              totalPagado={project.totalPagado}
              fechaAceptacion={project.fechaAceptacion}
              isPlaceholder={project.nombre === ""}
            />
          ))}
        </div>
      )}
    </div>
  );
}
