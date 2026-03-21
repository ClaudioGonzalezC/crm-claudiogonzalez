import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Upload,
  Loader2,
  AlertCircle,
  Download,
  Trash2,
  FileText,
  Archive,
  File,
  CheckCircle2,
  Eye,
} from "lucide-react";

export interface ProjectFile {
  id: number;
  proyecto_id: number;
  nombre_archivo: string;
  tipo_mime: string;
  peso_formateado: string;
  nombre_servidor: string;
  fecha_subida: string;
}

interface FileManagementProps {
  projectId: number;
  readOnly?: boolean;
  onFilesUpdate?: (files: ProjectFile[]) => void;
  rol?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const API_BASE_URL = "https://crm.claudiogonzalez.dev/";

const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  if (["pdf"].includes(ext)) {
    return <FileText className="w-5 h-5 text-red-400" />;
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <Archive className="w-5 h-5 text-orange-400" />;
  }
  return <File className="w-5 h-5 text-gray-400" />;
};

const isImageFile = (typeMime: string): boolean => {
  return typeMime.startsWith("image/");
};

const isPdfFile = (fileName: string): boolean => {
  return fileName.toLowerCase().endsWith(".pdf");
};

export default function FileManagement({
  projectId,
  readOnly = false,
  onFilesUpdate,
  rol,
}: FileManagementProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Fetch files when component mounts or projectId changes
  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    setLoading(true);
    console.log("📂 Obteniendo archivos del proyecto...");

    try {
      const timestamp = new Date().getTime();
      const response = await axios.get(
        `${API_BASE_URL}api/obtener_archivos.php?proyecto_id=${projectId}&t=${timestamp}`
      );

      const filesData = Array.isArray(response.data)
        ? response.data
        : response.data.archivos || [];

      console.log("📁 Archivos obtenidos:", filesData);

      const sanitizedFiles = filesData.map((f: any) => {
        const sanitized = {
          id: f.id,
          proyecto_id: f.proyecto_id,
          nombre_archivo: f.nombre_archivo || f.nombre || "",
          tipo_mime: f.tipo_mime || f.tipo || "",
          peso_formateado: f.peso_formateado || "0 KB",
          nombre_servidor: f.nombre_servidor || "",
          fecha_subida: f.fecha_subida || "",
        };

        // Debug: mostrar cada archivo procesado
        console.log(`  📄 ${sanitized.nombre_archivo} → ${sanitized.nombre_servidor}`);

        return sanitized;
      });

      console.log("📁 Total de archivos sanitizados:", sanitizedFiles.length);
      setFiles(sanitizedFiles);
      if (onFilesUpdate) {
        onFilesUpdate(sanitizedFiles);
      }
    } catch (err) {
      console.error("❌ Error al obtener archivos:", err);
      if (axios.isAxiosError(err)) {
        console.error("  Status:", err.response?.status);
        console.error("  Data:", err.response?.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const buildFileUrl = (nombreServidor: string): string => {
    // Construir URL: https://crm.claudiogonzalez.dev/ + ruta completa
    return `${API_BASE_URL}${nombreServidor}`;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
    console.log("🎯 Arrastrando sobre zona de carga");
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
      console.log("❌ Arrastramiento salió de zona de carga");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log("📥 Archivo soltado:", file.name);
      // Simular cambio en input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        // Disparar onChange manualmente
        const event = new Event("change", { bubbles: true });
        fileInputRef.current.dispatchEvent(event);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`El archivo es demasiado grande. Máximo permitido: 10 MB`);
      setTimeout(() => setError(""), 5000);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setUploading(true);
    setError("");
    console.log("📤 Subiendo archivo:", file.name, file.size, "bytes");

    try {
      const formData = new FormData();
      formData.append("proyecto_id", projectId.toString());
      formData.append("archivo", file);

      const response = await axios.post(
        `${API_BASE_URL}api/subir_archivo.php`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("✅ Respuesta del API:", response.data);

      // Verificar si la respuesta tiene un error
      if (response.data.status === "error") {
        console.error("❌ Error del API:", response.data.message);
        setError(response.data.message || "Error al subir el archivo");
        setTimeout(() => setError(""), 5000);
      } else if (response.status === 200 || response.status === 201) {
        // Éxito confirmado
        setSuccess(true);

        // Clear input immediately
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        // Delay de 500ms para que el servidor procese el archivo
        console.log("⏳ Esperando 500ms antes de refrescar lista...");
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Refresh file list after successful upload
        console.log("🔄 Refrescando lista de archivos...");
        await fetchFiles();

        // Hide success message after delay
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error("❌ Error al subir archivo:", err);
      let errorMessage = "Error al subir el archivo";

      if (axios.isAxiosError(err)) {
        console.error("  Status HTTP:", err.response?.status);
        console.error("  Data:", err.response?.data);

        // Extraer mensaje del error desde la respuesta del servidor
        const apiMessage = err.response?.data?.message;
        if (apiMessage) {
          console.error("  Mensaje del API:", apiMessage);
          errorMessage = apiMessage;
        }

        // Mostrar error específico para 500 con más detalle
        if (err.response?.status === 500) {
          console.error("🚨 ERROR 500 - Problema en el servidor");
          console.error("  Mensaje detallado:", apiMessage || "No hay mensaje de error");
          console.error("  Respuesta completa:", err.response.data);

          // Si hay mensaje del API, usarlo. Si no, mensaje genérico
          if (!apiMessage) {
            errorMessage = "Error interno del servidor (500) - Revisa los logs del servidor";
          }
        }
      }

      setError(errorMessage);
      setTimeout(() => setError(""), 7000); // Aumentar a 7 segundos para errores detallados
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = (file: ProjectFile) => {
    const fileUrl = buildFileUrl(file.nombre_servidor);
    console.log("📥 Descargando archivo:", file.nombre_archivo);
    console.log("   nombre_servidor:", file.nombre_servidor);
    console.log("   URL final:", fileUrl);

    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = file.nombre_archivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewPdf = (file: ProjectFile) => {
    const fileUrl = buildFileUrl(file.nombre_servidor);
    console.log("👁️ Abriendo PDF:", file.nombre_archivo);
    console.log("   nombre_servidor:", file.nombre_servidor);
    console.log("   URL final:", fileUrl);
    window.open(fileUrl, "_blank");
  };

  const handleDeleteFile = async (fileId: number, fileName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${fileName}"?`)) {
      return;
    }

    console.log("🗑️ Eliminando archivo:", fileId);

    try {
      const dataToSend = {
        id: fileId,
      };

      const response = await axios.post(
        `${API_BASE_URL}api/eliminar_archivo.php`,
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Respuesta eliminación:", response.data);

      // Verificar si la respuesta tiene un error
      if (response.data.status === "error") {
        console.error("❌ Error del API al eliminar:", response.data.message);
        setError(response.data.message || "Error al eliminar el archivo");
        setTimeout(() => setError(""), 5000);
      } else if (response.status === 200 || response.status === 201) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        await fetchFiles();
      }
    } catch (err) {
      console.error("❌ Error al eliminar archivo:", err);
      let errorMessage = "Error al eliminar el archivo";

      if (axios.isAxiosError(err)) {
        console.error("  Status HTTP:", err.response?.status);
        console.error("  Data:", err.response?.data);

        // Extraer mensaje del error desde la respuesta del servidor
        const apiMessage = err.response?.data?.message;
        if (apiMessage) {
          console.error("  Mensaje del API:", apiMessage);
          errorMessage = apiMessage;
        }

        // Mostrar error específico para 500
        if (err.response?.status === 500) {
          console.error("🚨 ERROR 500 al eliminar - Problema en el servidor");
          console.error("  Mensaje detallado:", apiMessage || "No hay mensaje de error");
          if (!apiMessage) {
            errorMessage = "Error interno del servidor (500) al eliminar";
          }
        }
      }

      setError(errorMessage);
      setTimeout(() => setError(""), 7000);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
      <h3 className="text-2xl font-bold text-white">Gestión de Documentos</h3>

      {/* Error Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400 text-sm">Operación completada correctamente</p>
        </div>
      )}

      {/* Upload Zone - Only show if not readOnly and not colaborador */}
      {!readOnly && rol !== 'colaborador' && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              isDragging
                ? "border-blue-400 bg-blue-500/10"
                : "border-slate-600/50 hover:border-slate-500/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
              accept="*/*"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer block">
              <div className="flex flex-col items-center gap-3">
                <Upload
                  className={`w-8 h-8 transition ${
                    isDragging
                      ? "text-blue-400"
                      : uploading
                      ? "text-gray-500"
                      : "text-blue-400"
                  }`}
                />
                <div>
                  <p className="text-white font-semibold">
                    {isDragging
                      ? "¡Suelta el archivo aquí!"
                      : uploading
                      ? "Subiendo..."
                      : "Haz clic para seleccionar un archivo"}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    o arrastra y suelta aquí (máx. 10 MB)
                  </p>
                </div>
                {uploading && <Loader2 className="w-5 h-5 animate-spin text-blue-400" />}
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Files List */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-gray-400">Cargando archivos...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-8">
          <File className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">No hay archivos cargados aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 font-medium">
            {files.length} {files.length === 1 ? "archivo" : "archivos"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {files.map((file) => {
              const fileUrl = buildFileUrl(file.nombre_servidor);
              return (
                <div
                  key={file.id}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail or Icon */}
                    <div className="flex-shrink-0 pt-1">
                      {isImageFile(file.tipo_mime) ? (
                        <div className="w-12 h-12 bg-slate-700/50 rounded overflow-hidden border border-slate-600/50">
                          <img
                            src={fileUrl}
                            alt={file.nombre_archivo}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.warn("⚠️ Error cargando imagen:", file.nombre_archivo);
                              console.warn("   URL intentada:", fileUrl);
                              e.currentTarget.style.display = "none";
                              e.currentTarget.parentElement?.classList.add(
                                "flex",
                                "items-center",
                                "justify-center"
                              );
                            }}
                          />
                        </div>
                      ) : (
                        getFileIcon(file.nombre_archivo)
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-white font-medium truncate"
                        title={file.nombre_archivo}
                      >
                        {file.nombre_archivo}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {file.peso_formateado}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isPdfFile(file.nombre_archivo) && (
                        <button
                          onClick={() => handleViewPdf(file)}
                          className="p-2 hover:bg-purple-500/20 text-purple-400 rounded transition"
                          title="Ver PDF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadFile(file)}
                        className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition"
                        title="Descargar archivo"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {!readOnly && rol !== 'colaborador' && (
                        <button
                          onClick={() =>
                            handleDeleteFile(file.id, file.nombre_archivo)
                          }
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded transition"
                          title="Eliminar archivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
