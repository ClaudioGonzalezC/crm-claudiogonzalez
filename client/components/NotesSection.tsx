import { useState } from "react";
import axios from "axios";
import { Loader2, Trash2 } from "lucide-react";

export interface Note {
  id: number;
  nota: string;
  fecha: string;
  creado_por: string;
}

interface NotesSectionProps {
  projectId: number;
  notes: Note[];
  onNotesUpdate: (notes: Note[]) => void;
  rol?: string;
}

export default function NotesSection({
  projectId,
  notes,
  onNotesUpdate,
  rol,
}: NotesSectionProps) {
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      // Normalizar "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS" para evitar
      // ambigüedad de timezone entre navegadores. Si ya es ISO con offset, se deja.
      const normalized = dateString.includes('T') || dateString.includes('+')
        ? dateString
        : dateString.replace(' ', 'T');
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago', // siempre hora chilena, independiente del navegador
        year:   'numeric',
        month:  'long',
        day:    'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newNote.trim()) {
      setError("Por favor escribe una nota");
      return;
    }

    setAddingNote(true);
    setError("");

    try {
      const dataToSend = {
        proyecto_id: projectId,
        nota: newNote,
        creado_por: "Admin",
      };

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/gestionar_notas.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const addedNote: Note = {
        id: response.data.id,
        nota: newNote,
        fecha: new Date().toISOString(),
        creado_por: "Admin",
      };

      onNotesUpdate([addedNote, ...notes]);
      setNewNote("");
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al agregar nota"
          : "Error al agregar nota"
      );
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm("¿Eliminar esta nota?")) {
      return;
    }

    setDeletingId(noteId);
    setError("");

    try {
      const dataToSend = {
        id: noteId,
      };

      await axios.post(
        "https://crm.claudiogonzalez.dev/api/gestionar_notas.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      onNotesUpdate(notes.filter((note) => note.id !== noteId));
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al eliminar nota"
          : "Error al eliminar nota"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">
          Bitácora y Notas
        </h3>
        <p className="text-gray-400 text-sm">
          Registra notas de reuniones, pendientes y cambios importantes
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="space-y-3">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Escribe una nota, pendiente o comentario importante..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
        />
        <button
          type="submit"
          disabled={addingNote}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-2 transition"
        >
          {addingNote ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Agregar Nota"
          )}
        </button>
      </form>

      {/* Notes Timeline */}
      {notes.length > 0 ? (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 group hover:border-slate-600/50 transition"
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <p className="text-xs text-gray-500">
                  {formatDate(note.fecha)}
                </p>
                {rol !== 'colaborador' && (
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={deletingId === note.id}
                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                  >
                    {deletingId === note.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                {note.nota}
              </p>
              <p className="text-gray-500 text-xs mt-2">Por: {note.creado_por}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 text-sm">
          Sin notas aún. Añade tu primera nota para registrar el progreso.
        </div>
      )}
    </div>
  );
}
