import { useState } from "react";
import { Copy, Check, Link as LinkIcon } from "lucide-react";

interface ClientShareUrlProps {
  shareToken: string;
  projectName: string;
}

export default function ClientShareUrl({
  shareToken,
  projectName,
}: ClientShareUrlProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://crm.claudiogonzalez.dev/#/cliente/${shareToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copying to clipboard:", err);
    }
  };

  if (!shareToken) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <LinkIcon className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">
          Portal de Seguimiento para {projectName}
        </h3>
      </div>

      <p className="text-gray-400 text-sm">
        Comparte este enlace con el cliente para que pueda ver el progreso del proyecto:
      </p>

      <div className="flex gap-2">
        <div className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-3 overflow-hidden">
          <p className="text-gray-300 text-sm truncate font-mono">{shareUrl}</p>
        </div>
        <button
          onClick={handleCopy}
          className={`px-4 py-3 rounded-lg transition font-medium flex items-center gap-2 ${
            copied
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/30"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copiar
            </>
          )}
        </button>
      </div>

      <p className="text-gray-500 text-xs">
        💡 El cliente podrá ver el estado, horas trabajadas y pagos realizados sin acceso a otras funciones del CRM.
      </p>
    </div>
  );
}
