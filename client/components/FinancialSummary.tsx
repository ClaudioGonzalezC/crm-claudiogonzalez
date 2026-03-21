import { useState } from "react";
import axios from "axios";
import { Trash2, Plus, Loader2 } from "lucide-react";

export interface ExtraCost {
  id: number;
  descripcion: string;
  monto: number;
}

interface FinancialSummaryProps {
  projectId: number;
  hours: number;
  hourlyRate: number;
  extraCosts: ExtraCost[];
  onCostsUpdate: (costs: ExtraCost[]) => void;
  rol?: string;
}

export default function FinancialSummary({
  projectId,
  hours,
  hourlyRate,
  extraCosts,
  onCostsUpdate,
  rol,
}: FinancialSummaryProps) {
  const [newCost, setNewCost] = useState({ descripcion: "", monto: "" });
  const [addingCost, setAddingCost] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const subtotal = hours * hourlyRate;
  const extraCostsTotal = extraCosts.reduce((sum, cost) => sum + cost.monto, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCost.descripcion.trim() || !newCost.monto) {
      setError("Por favor completa todos los campos");
      return;
    }

    setAddingCost(true);
    setError("");

    try {
      const dataToSend = {
        proyecto_id: projectId,
        accion: "crear",
        descripcion: newCost.descripcion,
        monto: parseInt(newCost.monto),
      };

      console.log('💰 Agregando costo extra:', dataToSend);

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/gestionar_extras.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log('✅ Costo extra agregado exitosamente:', response.data);

      const newCostData: ExtraCost = {
        id: response.data.id,
        descripcion: newCost.descripcion,
        monto: parseInt(newCost.monto),
      };

      onCostsUpdate([...extraCosts, newCostData]);
      setNewCost({ descripcion: "", monto: "" });
    } catch (err) {
      console.error('❌ Error al agregar costo extra:', err);
      if (axios.isAxiosError(err)) {
        console.error('  Response Status:', err.response?.status);
        console.error('  Response Data:', err.response?.data);
        console.error('  Error Message:', err.message);
      }
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al agregar costo"
          : "Error al agregar costo"
      );
    } finally {
      setAddingCost(false);
    }
  };

  const handleDeleteCost = async (costId: number) => {
    if (!window.confirm("¿Eliminar este costo extra?")) {
      return;
    }

    setDeletingId(costId);
    setError("");

    try {
      const dataToSend = {
        proyecto_id: projectId,
        accion: "eliminar",
        id: costId,
      };

      console.log('🗑️ Eliminando costo extra:', dataToSend);

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/gestionar_extras.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log('✅ Costo extra eliminado:', response.data);
      onCostsUpdate(extraCosts.filter((cost) => cost.id !== costId));
    } catch (err) {
      console.error('❌ Error al eliminar costo extra:', err);
      if (axios.isAxiosError(err)) {
        console.error('  Response Status:', err.response?.status);
        console.error('  Response Data:', err.response?.data);
        console.error('  Error Message:', err.message);
      }
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al eliminar costo"
          : "Error al eliminar costo"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Resumen Financiero</h3>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Calculation */}
      <div className="space-y-3 pb-6 border-b border-slate-700/50">
        <div className="flex justify-between items-center">
          <p className="text-gray-400">Total Horas</p>
          <p className="text-xl font-bold text-white">{hours}h</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-gray-400">Valor Hora</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(hourlyRate)}
          </p>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-700/30">
          <p className="text-gray-300 font-semibold">Subtotal (Horas × Valor)</p>
          <p className="text-2xl font-bold text-blue-400">
            {formatCurrency(subtotal)}
          </p>
        </div>
      </div>

      {/* Extra Costs Section */}
      <div className="space-y-4">
        <h4 className="font-semibold text-white flex items-center gap-2">
          Costos Extra
          {extraCosts.length > 0 && (
            <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
              {extraCosts.length}
            </span>
          )}
        </h4>

        {/* Extra Costs List */}
        {extraCosts.length > 0 ? (
          <div className="space-y-2 mb-6 bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
            {extraCosts.map((cost) => (
              <div
                key={cost.id}
                className="flex justify-between items-center py-2 px-2 hover:bg-slate-700/30 rounded transition group"
              >
                <div className="flex-1">
                  <p className="text-gray-200 text-sm font-medium">
                    {cost.descripcion}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-green-400 font-semibold">
                    {formatCurrency(cost.monto)}
                  </p>
                  {rol !== 'colaborador' && (
                    <button
                      onClick={() => handleDeleteCost(cost.id)}
                      disabled={deletingId === cost.id}
                      className="p-1.5 text-red-400 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                    >
                      {deletingId === cost.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center py-2 px-2 border-t border-slate-600/30 mt-2 pt-4 font-semibold">
              <p className="text-gray-300">Total Costos Extra</p>
              <p className="text-green-400">{formatCurrency(extraCostsTotal)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            Sin costos extra agregados
          </div>
        )}

        {/* Add New Cost Form - Only for admin */}
        {rol !== 'colaborador' && (
        <form onSubmit={handleAddCost} className="space-y-3 bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
          <input
            type="text"
            placeholder="Descripción del costo"
            value={newCost.descripcion}
            onChange={(e) =>
              setNewCost({ ...newCost, descripcion: e.target.value })
            }
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Monto"
              value={newCost.monto}
              onChange={(e) => setNewCost({ ...newCost, monto: e.target.value })}
              className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 text-sm"
              min="0"
            />
            <button
              type="submit"
              disabled={addingCost}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm flex items-center gap-1 transition"
            >
              {addingCost ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Agregar
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
