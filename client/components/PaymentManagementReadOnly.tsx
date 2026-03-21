import { safeFormatDate, safeFormatCurrency } from "@/utils/dateFormatter";

export interface Payment {
  id: number;
  proyecto_id: number;
  monto: number;
  descripcion: string;
  fecha: string;
}

interface PaymentManagementReadOnlyProps {
  payments: Payment[];
  totalContract: number;
}

export default function PaymentManagementReadOnly({
  payments = [],
  totalContract = 0,
}: PaymentManagementReadOnlyProps) {
  // Defensive sum of payments array - handles null/undefined/empty arrays
  const totalPaid = (Array.isArray(payments) ? payments : []).reduce(
    (sum, payment) => sum + (parseFloat(String(payment?.monto || 0)) || 0),
    0
  );
  const totalPaidRounded = Math.round(totalPaid);

  // EMERGENCY FIX: If totalContract is 0 but there are payments, calculate based on payments
  // This prevents showing $0 balance when actual payments exist
  const effectiveTotal = totalContract > 0
    ? totalContract
    : totalPaidRounded > 0
      ? totalPaidRounded  // Fallback: use total paid as contract value
      : 0;

  // DEBUG: Log values for auditing
  console.log('🔍 PaymentManagementReadOnly DEBUG:', {
    totalContractPassed: totalContract,
    totalPaidRounded: totalPaidRounded,
    effectiveTotal: effectiveTotal,
    paymentsCount: payments.length,
  });

  const pendingBalance = Math.max(effectiveTotal - totalPaidRounded, 0);
  const percentagePaid = effectiveTotal > 0 ? ((totalPaidRounded / effectiveTotal) * 100).toFixed(1) : '0';

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 space-y-6">
      <h3 className="text-2xl font-bold text-white">Gestión de Pagos</h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Total del Contrato</p>
          <p className="text-2xl font-bold text-blue-400">
            {safeFormatCurrency(effectiveTotal)}
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Pagado a la Fecha</p>
          <p className="text-2xl font-bold text-emerald-400">
            {safeFormatCurrency(totalPaidRounded)}
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Saldo Pendiente</p>
          <p
            className={`text-2xl font-bold ${
              pendingBalance === 0 ? "text-emerald-400" : "text-orange-400"
            }`}
          >
            {safeFormatCurrency(Math.max(pendingBalance, 0))}
          </p>
        </div>
      </div>

      {/* Payment Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center mb-2">
          <p className="text-gray-400 text-sm">Progreso</p>
          <p className="text-gray-300 text-sm font-semibold">{percentagePaid}%</p>
        </div>
        <div className="relative w-full h-2 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-300"
            style={{ width: `${Math.min(percentagePaid, 100)}%` }}
          />
        </div>
      </div>

      {/* Payments History - Desktop Table */}
      {payments.length > 0 && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
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
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {[...payments]
              .sort(
                (a, b) =>
                  new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
              )
              .map((payment) => (
                <div
                  key={payment.id}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-gray-400 text-xs">{safeFormatDate(payment.fecha, { includeTime: true })}</p>
                    <p className="text-lg font-bold text-emerald-400">{safeFormatCurrency(payment.monto)}</p>
                  </div>
                  <p className="text-gray-300 text-sm">{payment.descripcion}</p>
                </div>
              ))}
          </div>
        </>
      )}

      {payments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No hay pagos registrados aún</p>
        </div>
      )}
    </div>
  );
}
