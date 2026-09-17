import React, { useEffect, useState } from 'react';
import { GraduationCap, FileText, CreditCard, FileSignature, CheckCircle, AlertTriangle, Download, Loader2 } from 'lucide-react';

// Contexto de demostración: en producción estos IDs vienen del token JWT de Supabase Auth (Fase 2)
const DEMO_STUDENT_ID = 'student-demo-123';

type TabId = 'grades' | 'bulletins' | 'contracts' | 'payments';

interface ClassEnrollment {
  final_grade: number | null;
  classes?: { name: string; courses?: { name: string; credits: number } };
}

interface Enrollment {
  id: string;
  status: string;
  contract_url: string | null;
  academic_terms?: { name: string; start_date: string; end_date: string };
  class_enrollments?: ClassEnrollment[];
}

interface ReportCard {
  id: string;
  gpa: string;
  published_at: string;
  academic_terms?: { name: string };
  report_card_details?: { final_score: number; classes?: { name: string } }[];
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
}

export const ParentStudentPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('grades');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [enrollmentsRes, bulletinsRes, invoicesRes] = await Promise.all([
          fetch(`/api/v1/enrollments/${DEMO_STUDENT_ID}`),
          fetch(`/api/v1/bulletins/${DEMO_STUDENT_ID}`),
          fetch(`/api/v1/finance/invoices/${DEMO_STUDENT_ID}`),
        ]);

        const enrollmentsData = await enrollmentsRes.json();
        const bulletinsData = await bulletinsRes.json();
        const invoicesData = await invoicesRes.json();

        setEnrollments(enrollmentsData.enrollments || []);
        setReportCards(bulletinsData.reportCards || []);
        setInvoices(invoicesData.invoices || []);
      } catch (error) {
        setMessage('❌ No se pudo conectar con el servidor SIS.');
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handlePay = async (invoiceId: string, method: 'checkout' | 'checkout/yappy') => {
    setPayingInvoiceId(invoiceId);
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
    setPayingInvoiceId(null);
  };

  const pendingContract = enrollments.find(e => e.status === 'pending_signature' && e.contract_url);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-emerald-100 text-emerald-700',
      open: 'bg-amber-100 text-amber-700',
      overdue: 'bg-rose-100 text-rose-700',
      pending_signature: 'bg-amber-100 text-amber-700',
      active: 'bg-emerald-100 text-emerald-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg text-purple-700">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Portal de Padres y Alumnos</h1>
            <p className="text-sm text-slate-500">Calificaciones, boletines, contratos y colegiaturas</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg flex items-start border border-indigo-200 break-all">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('grades')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'grades' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <GraduationCap className="w-4 h-4 mr-2" /> Calificaciones
        </button>
        <button
          onClick={() => setActiveTab('bulletins')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'bulletins' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <FileText className="w-4 h-4 mr-2" /> Boletines
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'contracts' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <FileSignature className="w-4 h-4 mr-2" /> Contratos
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'payments' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CreditCard className="w-4 h-4 mr-2" /> Colegiaturas
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Cargando información del SIS...
        </div>
      ) : (
        <>
          {activeTab === 'grades' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700">Historial de Matrículas y Calificaciones</h2>
              </div>
              {enrollments.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">Sin matrículas registradas para este alumno.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {enrollments.map(enrollment => (
                    <div key={enrollment.id} className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-slate-700">{enrollment.academic_terms?.name || 'Ciclo académico'}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusBadge(enrollment.status)}`}>{enrollment.status}</span>
                      </div>
                      {enrollment.class_enrollments && enrollment.class_enrollments.length > 0 ? (
                        <table className="w-full text-left text-sm mt-2">
                          <thead className="text-slate-400 text-xs uppercase">
                            <tr>
                              <th className="py-1">Curso</th>
                              <th className="py-1 text-right">Nota Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enrollment.class_enrollments.map((c, i) => (
                              <tr key={i} className="border-t border-slate-50">
                                <td className="py-1.5">{c.classes?.courses?.name || c.classes?.name || 'Materia'}</td>
                                <td className="py-1.5 text-right font-bold">{c.final_grade ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-slate-400">Aún no hay calificaciones cargadas para este ciclo.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bulletins' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700">Boletines de Calificaciones Publicados</h2>
              </div>
              {reportCards.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">Todavía no hay boletines publicados para este alumno.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reportCards.map(rc => (
                    <div key={rc.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-700">{rc.academic_terms?.name || 'Boletín'}</p>
                        <p className="text-xs text-slate-500">Promedio general (GPA): <span className="font-bold">{rc.gpa}</span></p>
                      </div>
                      <button className="flex items-center text-purple-600 font-bold hover:text-purple-800 bg-purple-50 px-3 py-1.5 rounded">
                        <Download className="w-4 h-4 mr-1.5" /> Descargar PDF
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700">Contratos de Matrícula</h2>
              </div>
              {pendingContract ? (
                <div className="p-4 space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold">Firma pendiente</p>
                      <p className="mt-1">Hay un contrato de matrícula esperando tu firma electrónica para continuar el proceso.</p>
                    </div>
                  </div>
                  <a
                    href={pendingContract.contract_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-semibold"
                  >
                    <FileSignature className="w-4 h-4 mr-2" /> Revisar y Firmar Contrato
                  </a>
                </div>
              ) : (
                <p className="p-6 text-sm text-slate-400">No tienes contratos pendientes de firma.</p>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700">Facturas de Colegiatura</h2>
              </div>
              {invoices.length === 0 ? (
                <p className="p-6 text-sm text-slate-400">No hay facturas registradas para este alumno.</p>
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
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">{inv.invoice_number}</td>
                        <td className="px-4 py-3">{inv.currency} {Number(inv.amount).toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-500">{inv.due_date}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusBadge(inv.status)}`}>{inv.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {inv.status !== 'paid' && (
                            <>
                              <button
                                onClick={() => handlePay(inv.id, 'checkout')}
                                disabled={payingInvoiceId === inv.id}
                                className="text-purple-600 font-bold hover:text-purple-800 bg-purple-50 px-3 py-1 rounded disabled:opacity-50"
                              >
                                Tarjeta
                              </button>
                              <button
                                onClick={() => handlePay(inv.id, 'checkout/yappy')}
                                disabled={payingInvoiceId === inv.id}
                                className="text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded disabled:opacity-50"
                              >
                                Yappy
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
