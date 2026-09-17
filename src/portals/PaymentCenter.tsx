import React, { useEffect, useState } from 'react';
import { CreditCard, FileText, Receipt, Loader2, CheckCircle } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  issued_date?: string;
}

interface Payment {
  id: string;
  amount_paid: number;
  payment_date: string;
  method: string;
  transaction_reference: string | null;
  receipt_url: string | null;
  invoices?: { invoice_number: string };
}

type SubTab = 'online' | 'statement' | 'receipts';

interface Props {
  studentId: string;
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-700',
    open: 'bg-amber-100 text-amber-700',
    overdue: 'bg-rose-100 text-rose-700',
    void: 'bg-slate-100 text-slate-500',
  };
  return styles[status] || 'bg-slate-100 text-slate-700';
};

export const PaymentCenter: React.FC<Props> = ({ studentId }) => {
  const [subTab, setSubTab] = useState<SubTab>('online');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [invRes, payRes] = await Promise.all([
          fetch(`/api/v1/finance/invoices/${studentId}`),
          fetch(`/api/v1/finance/payments/${studentId}`),
        ]);
        const invData = await invRes.json();
        const payData = await payRes.json();
        setInvoices(invData.invoices || []);
        setPayments(payData.payments || []);
      } catch {
        setMessage('❌ No se pudo conectar con el servidor SIS.');
      }
      setLoading(false);
    };
    load();
  }, [studentId]);

  const handlePay = async (invoiceId: string, method: 'checkout' | 'checkout/yappy') => {
    setPayingId(invoiceId);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/finance/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await response.json();
      if (data.success && data.checkout_url) {
        setMessage(`✅ Enlace de pago generado: ${data.checkout_url}`);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo iniciar el pago.'));
      }
    } catch {
      setMessage('❌ Error de conexión al procesar el pago.');
    }
    setPayingId(null);
  };

  const pending = invoices.filter(inv => inv.status !== 'paid');
  const totalBalance = pending.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + Number(inv.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Cargando Centro de Pagos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg flex items-start border border-indigo-200 break-all">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-100 pb-1">
        <button
          onClick={() => setSubTab('online')}
          className={`px-3 py-1.5 text-sm font-bold rounded-t-lg flex items-center ${subTab === 'online' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CreditCard className="w-4 h-4 mr-1.5" /> Pagos Online
        </button>
        <button
          onClick={() => setSubTab('statement')}
          className={`px-3 py-1.5 text-sm font-bold rounded-t-lg flex items-center ${subTab === 'statement' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <FileText className="w-4 h-4 mr-1.5" /> Estado de Cuenta
        </button>
        <button
          onClick={() => setSubTab('receipts')}
          className={`px-3 py-1.5 text-sm font-bold rounded-t-lg flex items-center ${subTab === 'receipts' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Receipt className="w-4 h-4 mr-1.5" /> Comprobantes
        </button>
      </div>

      {subTab === 'online' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-700">Facturas Pendientes</h2>
            <span className="text-sm font-bold text-rose-600">Balance: USD {totalBalance.toFixed(2)}</span>
          </div>
          {pending.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No tienes facturas pendientes. ¡Estás al día!</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">FACTURA</th>
                  <th className="px-4 py-3 font-semibold">MONTO</th>
                  <th className="px-4 py-3 font-semibold">VENCE</th>
                  <th className="px-4 py-3 font-semibold">ESTADO</th>
                  <th className="px-4 py-3 font-semibold text-right">PAGO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-600">{inv.invoice_number}</td>
                    <td className="px-4 py-3">{inv.currency} {Number(inv.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.due_date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusBadge(inv.status)}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handlePay(inv.id, 'checkout')}
                        disabled={payingId === inv.id}
                        className="text-teal-600 font-bold hover:text-teal-800 bg-teal-50 px-3 py-1 rounded disabled:opacity-50"
                      >
                        Tarjeta
                      </button>
                      <button
                        onClick={() => handlePay(inv.id, 'checkout/yappy')}
                        disabled={payingId === inv.id}
                        className="text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded disabled:opacity-50"
                      >
                        Yappy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {subTab === 'statement' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Balance Pendiente</p>
              <p className="text-xl font-black text-rose-600">USD {totalBalance.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Total Pagado</p>
              <p className="text-xl font-black text-emerald-600">USD {totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Facturas Totales</p>
              <p className="text-xl font-black text-slate-700">{invoices.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Historial de Facturación</h2>
            </div>
            {invoices.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">No hay facturas registradas para este alumno.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">FACTURA</th>
                    <th className="px-4 py-3 font-semibold">EMITIDA</th>
                    <th className="px-4 py-3 font-semibold">VENCE</th>
                    <th className="px-4 py-3 font-semibold">MONTO</th>
                    <th className="px-4 py-3 font-semibold">ESTADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.issued_date || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.due_date}</td>
                      <td className="px-4 py-3">{inv.currency} {Number(inv.amount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusBadge(inv.status)}`}>{inv.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {subTab === 'receipts' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-700">Comprobantes de Pago</h2>
          </div>
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">Aún no hay pagos registrados para este alumno.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">FACTURA</th>
                  <th className="px-4 py-3 font-semibold">FECHA</th>
                  <th className="px-4 py-3 font-semibold">MONTO PAGADO</th>
                  <th className="px-4 py-3 font-semibold">MÉTODO</th>
                  <th className="px-4 py-3 font-semibold text-right">COMPROBANTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-600">{p.invoices?.invoice_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(p.payment_date).toLocaleDateString('es')}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">USD {Number(p.amount_paid).toFixed(2)}</td>
                    <td className="px-4 py-3 capitalize">{p.method}</td>
                    <td className="px-4 py-3 text-right">
                      {p.receipt_url ? (
                        <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-teal-600 font-bold hover:text-teal-800 bg-teal-50 px-3 py-1 rounded inline-block">
                          Descargar
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">No disponible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
