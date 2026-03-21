import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, AlertCircle, Plus, Trash2, CheckCircle2, X, Edit2 } from "lucide-react";
import { safeFormatDate, safeFormatCurrency } from "@/utils/dateFormatter";

export interface Payment {
  id: number;
  proyecto_id: number;
  monto: number;
  descripcion: string;
  fecha: string;
}

type ProjectStatus = "Cotización" | "En Desarrollo" | "Revisiones" | "Finalizado" | "Cobrado";

interface PaymentManagementProps {
  projectId: number;
  payments: Payment[];
  totalContract: number;
  projectStatus?: ProjectStatus;
  onPaymentsUpdate: (payments: Payment[]) => void;
  onStatusChange?: (newStatus: ProjectStatus) => void;
  onRefreshProject?: () => void;
  rol?: string;
}

export default function PaymentManagement({
  projectId,
  payments,
  totalContract,
  projectStatus = "En Desarrollo",
  onPaymentsUpdate,
  onStatusChange,
  onRefreshProject,
  rol,
}: PaymentManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingFormData, setEditingFormData] = useState({
    monto: "",
    fecha_pago: "",
  });
  const [formData, setFormData] = useState({
    monto: "",
    descripcion: "",
    fecha_pago: new Date().toISOString().split("T")[0],
  });

  const totalPaid = payments.reduce((sum, payment) => sum + payment.monto, 0);
  const pendingBalance = totalContract - totalPaid;
  const totalPaidRounded = Math.round(totalPaid);
  const pendingBalanceRounded = Math.round(pendingBalance);

  // Effect: Detect when payment completes (balance = 0) and show completion modal
  useEffect(() => {
    // Only trigger if:
    // 1. Success flag is set (payment just registered)
    // 2. Pending balance is zero
    // 3. Project is NOT already "Cobrado"
    // 4. Modal is not already shown
    if (success && pendingBalanceRounded === 0 && projectStatus !== "Cobrado" && !showCompletionModal) {
      setShowCompletionModal(true);
      // Clear success flag after showing modal
      setTimeout(() => setSuccess(false), 100);
    }
  }, [success, pendingBalanceRounded, projectStatus, showCompletionModal]);

  const handleUpdateStatusToCobrado = async () => {
    setUpdatingStatus(true);

    try {
      const dataToSend = {
        proyecto_id: projectId,
        estado_id: "Cobrado",
      };

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/actualizar_estado.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        // Update local state
        if (onStatusChange) {
          onStatusChange("Cobrado");
        }

        // Refresh project data to ensure all fields are updated
        if (onRefreshProject) {
          onRefreshProject();
        }

        setStatusUpdateSuccess(true);
        setShowCompletionModal(false);

        // Show success message briefly
        setTimeout(() => {
          setStatusUpdateSuccess(false);
        }, 3000);
      }
    } catch (err) {
      // Error handled silently
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setEditingFormData({
      monto: payment.monto.toString(),
      fecha_pago: payment.fecha,
    });
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    const updatedMonto = parseFloat(editingFormData.monto);
    if (!updatedMonto || updatedMonto <= 0) {
      return;
    }

    setLoading(true);
    try {
      const dataToSend = {
        id: editingPayment.id,
        monto: updatedMonto,
        fecha_pago: editingFormData.fecha_pago,
      };

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/actualizar_pago.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        // Fetch updated payments
        try {
          const timestamp = new Date().getTime();
          const paymentsResponse = await axios.get(
            `https://crm.claudiogonzalez.dev/api/obtener_pagos.php?proyecto_id=${projectId}&t=${timestamp}`
          );
          const paymentsData = Array.isArray(paymentsResponse.data)
            ? paymentsResponse.data
            : paymentsResponse.data.pagos || [];

          const sanitizedPayments = paymentsData.map((p: any) => ({
            id: p.id,
            proyecto_id: p.proyecto_id,
            monto: parseFloat(p.monto) || 0,
            descripcion: p.descripcion || '',
            fecha: p.fecha_pago || p.fecha || '',
          }));

          onPaymentsUpdate(sanitizedPayments);
          setEditingPayment(null);

          // Check if we need to unlock "Cobrado" status
          const newTotalPaid = sanitizedPayments.reduce((sum, p) => sum + p.monto, 0);
          const newPendingBalance = Math.round(totalContract - newTotalPaid);

          if (newPendingBalance > 0 && projectStatus === "Cobrado") {
            if (onStatusChange) {
              onStatusChange("En Desarrollo");
            }
          }

          // Refresh project data
          if (onRefreshProject) {
            onRefreshProject();
          }
        } catch (err) {
          // Error fetching payments handled silently
        }
      }
    } catch (err) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!formData.monto || !formData.descripcion || !formData.fecha_pago) {
      setError("Por favor completa todos los campos");
      setLoading(false);
      return;
    }

    try {
      const monto = parseFloat(formData.monto);
      if (monto <= 0) {
        setError("El monto debe ser mayor a 0");
        setLoading(false);
        return;
      }

      const dataToSend = {
        proyecto_id: projectId,
        monto: monto,
        descripcion: formData.descripcion,
        fecha_pago: formData.fecha_pago,
      };

      const response = await axios.post(
        "https://crm.claudiogonzalez.dev/api/registrar_pago.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        setSuccess(true);
        setFormData({
          monto: "",
          descripcion: "",
          fecha_pago: new Date().toISOString().split("T")[0],
        });

        // Fetch updated payments
        try {
          const timestamp = new Date().getTime();
          const paymentsResponse = await axios.get(
            `https://crm.claudiogonzalez.dev/api/obtener_pagos.php?proyecto_id=${projectId}&t=${timestamp}`
          );
          const paymentsData = Array.isArray(paymentsResponse.data)
            ? paymentsResponse.data
            : paymentsResponse.data.pagos || [];

          // Sanitize payment data - use fecha_pago from API
          const sanitizedPayments = paymentsData.map((p: any) => ({
            id: p.id,
            proyecto_id: p.proyecto_id,
            monto: parseFloat(p.monto) || 0,
            descripcion: p.descripcion || '',
            fecha: p.fecha_pago || p.fecha || '',
          }));

          onPaymentsUpdate(sanitizedPayments);
        } catch (err) {
          // Error fetching payments handled silently
        }

        setTimeout(() => {
          setSuccess(false);
          setShowForm(false);
        }, 2000);
      }
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Error al registrar pago"
          : "Error al registrar pago"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este pago?")) {
      return;
    }

    try {
      const dataToSend = {
        id: paymentId,
      };

      await axios.post(
        "https://crm.claudiogonzalez.dev/api/eliminar_pago.php",
        dataToSend,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Fetch updated payments
      try {
        const timestamp = new Date().getTime();
        const paymentsResponse = await axios.get(
          `https://crm.claudiogonzalez.dev/api/obtener_pagos.php?proyecto_id=${projectId}&t=${timestamp}`
        );
        const paymentsData = Array.isArray(paymentsResponse.data)
          ? paymentsResponse.data
          : paymentsResponse.data.pagos || [];

        const sanitizedPayments = paymentsData.map((p: any) => ({
          id: p.id,
          proyecto_id: p.proyecto_id,
          monto: parseFloat(p.monto) || 0,
          descripcion: p.descripcion || '',
          fecha: p.fecha_pago || p.fecha || '',
        }));

        onPaymentsUpdate(sanitizedPayments);

        // Check if we need to unlock "Cobrado" status
        const newTotalPaid = sanitizedPayments.reduce((sum, p) => sum + p.monto, 0);
        const newPendingBalance = Math.round(totalContract - newTotalPaid);

        if (newPendingBalance > 0 && projectStatus === "Cobrado") {
          if (onStatusChange) {
            onStatusChange("En Desarrollo");
          }
        }

        // Refresh project data
        if (onRefreshProject) {
          onRefreshProject();
        }
      } catch (err) {
        // Error fetching payments handled silently
      }
    } catch (err) {
      // Error handled silently
    }
  };

  return (
    <>
      <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
        <h3 className="text-2xl font-bold text-white">Gestión de Pagos</h3>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/30 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Total del Contrato</p>
            <p className="text-2xl font-bold text-blue-400">
              {safeFormatCurrency(totalContract)}
            </p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Pagado a la Fecha</p>
            <p className="text-2xl font-bold text-emerald-400">
              {safeFormatCurrency(totalPaid)}
            </p>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Saldo Pendiente</p>
            <p className={`text-2xl font-bold ${
              pendingBalance === 0 ? "text-emerald-400" : "text-orange-400"
            }`}>
              {safeFormatCurrency(Math.max(pendingBalance, 0))}
            </p>
          </div>
        </div>

        {/* Payments History Table */}
        {payments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...payments]
                  .sort(
                    (a, b) =>
                      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
                  )
                  .map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-700/30 hover:bg-slate-800/20 transition"
                    >
                      <td className="px-4 py-3 text-gray-300">
                        {safeFormatDate(payment.fecha, { includeTime: true })}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {payment.descripcion}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                        {safeFormatCurrency(payment.monto)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {rol !== 'colaborador' && (
                            <>
                              <button
                                onClick={() => handleEditPayment(payment)}
                                className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition"
                                title="Editar pago"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="p-2 hover:bg-red-500/20 text-red-400 rounded transition"
                                title="Eliminar pago"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {payments.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No hay pagos registrados aún</p>
          </div>
        )}

        {/* Register Payment Button - Only for admin */}
        {!showForm && rol !== 'colaborador' && (
          <>
            {projectStatus === "Cobrado" && (
              <div className="w-full p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>Proyecto Liquidado - No se pueden agregar más pagos</span>
              </div>
            )}
            <button
              onClick={() => setShowForm(true)}
              disabled={projectStatus === "Cobrado"}
              title={projectStatus === "Cobrado" ? "No se pueden agregar pagos a un proyecto Cobrado" : ""}
              className={`w-full py-3 px-4 rounded-lg transition font-semibold flex items-center justify-center gap-2 ${
                projectStatus === "Cobrado"
                  ? "bg-slate-700/30 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              }`}
            >
              <Plus className="w-5 h-5" />
              Registrar Nuevo Pago
            </button>
          </>
        )}

        {/* Payment Form */}
        {showForm && (
          <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-6 space-y-4">
            <h4 className="font-semibold text-white mb-4">Registrar Nuevo Pago</h4>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-400 text-sm">Pago registrado correctamente</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  name="monto"
                  value={formData.monto}
                  onChange={handleInputChange}
                  placeholder="Ej: 500000"
                  min="0"
                  step="1000"
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha de Pago <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  name="fecha_pago"
                  value={formData.fecha_pago}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descripción <span className="text-red-400">*</span>
              </label>
              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleInputChange}
                placeholder="Ej: Abono 50% o Pago Final"
                rows={3}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-700/50 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Pago"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full space-y-6 p-8 shadow-2xl animate-in fade-in scale-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  ¡Pago Completado!
                </h3>
                <p className="text-gray-400 text-sm">
                  El saldo de este proyecto ha sido liquidado
                </p>
              </div>
              <button
                onClick={() => setShowCompletionModal(false)}
                className="text-gray-400 hover:text-gray-300 transition"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-400">Resumen Final:</p>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Contrato:</span>
                <span className="text-lg font-bold text-blue-400">
                  {safeFormatCurrency(totalContract)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total Pagado:</span>
                <span className="text-lg font-bold text-emerald-400">
                  {safeFormatCurrency(totalPaidRounded)}
                </span>
              </div>
              <div className="border-t border-slate-600/50 pt-3 flex justify-between items-center">
                <span className="text-gray-300">Saldo Pendiente:</span>
                <span className="text-lg font-bold text-emerald-500">
                  {safeFormatCurrency(0)}
                </span>
              </div>
            </div>

            {statusUpdateSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-400 text-sm">Estado actualizado a Cobrado correctamente</p>
              </div>
            )}

            <p className="text-gray-300 text-center">
              ¿Deseas marcar el proyecto como <span className="font-semibold text-emerald-400">Cobrado</span> ahora?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCompletionModal(false)}
                disabled={updatingStatus}
                className="flex-1 py-2 px-4 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-700/50 transition font-medium disabled:opacity-50"
              >
                Después
              </button>
              <button
                onClick={handleUpdateStatusToCobrado}
                disabled={updatingStatus}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
              >
                {updatingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>Sí, Marcar como Cobrado</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full space-y-6 p-8 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-8 h-8 text-blue-400" />
                  Editar Pago
                </h3>
                <p className="text-gray-400 text-sm">
                  Actualiza los datos del pago registrado
                </p>
              </div>
              <button
                onClick={() => setEditingPayment(null)}
                className="text-gray-400 hover:text-gray-300 transition"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monto <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={editingFormData.monto}
                  onChange={(e) => setEditingFormData({ ...editingFormData, monto: e.target.value })}
                  placeholder="Ej: 500000"
                  min="0"
                  step="1000"
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha de Pago <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={editingFormData.fecha_pago}
                  onChange={(e) => setEditingFormData({ ...editingFormData, fecha_pago: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition"
                  required
                />
              </div>

              <div className="space-y-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                <p className="text-sm text-gray-400">Información Original:</p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Descripción:</span> {editingPayment.descripcion}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Fecha Original:</span> {safeFormatDate(editingPayment.fecha, { includeTime: true })}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  disabled={loading}
                  className="flex-1 py-2 px-4 border border-slate-600/50 text-gray-300 rounded-lg hover:bg-slate-700/50 transition font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>Guardar Cambios</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
