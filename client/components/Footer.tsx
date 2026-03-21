export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 border-t border-slate-700/50 py-8 mt-auto flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © {currentYear} Claudio González | Gestión de Proyectos
          </p>
          <p className="text-gray-600 text-xs">
            CRM de Administración de Proyectos
          </p>
        </div>
      </div>
    </footer>
  );
}
