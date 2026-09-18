import React, { useEffect, useState } from 'react';
import {
  X, Loader2, User, GraduationCap, ClipboardList, DollarSign, CalendarCheck,
  AlertTriangle, FileText, ShieldAlert,
} from 'lucide-react';

interface Props {
  studentId: string;
  onClose: () => void;
}

type TabId = 'general' | 'academico' | 'asistencia' | 'documentos' | 'finanzas';

interface FullRecord {
  student: Record<string, any>;
  guardians: { relationship: string; profiles: { id: string; first_name: string; last_name: string; email: string; phone: string | null; role: string } | null }[];
  academicHistory: { id: string; status: string; enrollment_date: string; academic_terms: { name: string; start_date: string; end_date: string } | null; class_enrollments: { final_grade: number | null; classes: { name: string; courses: { name: string } | null } | null }[] }[];
  reportCards: { id: string; gpa: number | null; is_published: boolean; published_at: string | null; academic_terms: { name: string } | null; report_card_details: { final_score: number | null; classes: { name: string } | null }[] }[];
  documents: { id: string; doc_type: string; title: string | null; status: string; file_url: string; download_url?: string | null; created_at: string }[];
  attendance: { records: { id: string; date: string; status: string; notes: string | null; classes: { name: string; courses: { name: string } | null } | null }[]; summary: { present: number; absent: number; late: number; excused: number } };
  alerts: { id: string; type: string; risk_level: string; description: string; is_resolved: boolean; resolution_notes: string | null; created_at: string }[];
  invoices: { id: string; invoice_number: string; amount: number; currency: string; status: string; due_date: string; issued_date: string; invoice_line_items: { description: string; quantity: number; unit_price: number; discount: number | null }[] }[];
  payments: { id: string; amount_paid: number; payment_date: string; method: string; transaction_reference: string | null; invoices: { invoice_number: string } | null }[];
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'Datos Generales', icon: User },
  { id: 'academico', label: 'Historial Académico', icon: GraduationCap },
  { id: 'asistencia', label: 'Asistencia y Alertas', icon: CalendarCheck },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'finanzas', label: 'Cobros y Pagos', icon: DollarSign },
];

const money = (n: number | null | undefined, currency = 'USD') =>
  `${currency === 'USD' ? '$' : currency + ' '}${Number(n || 0).toFixed(2)}`;

export const StudentFile: React.FC<Props> = ({ studentId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<FullRecord | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/v1/students/${studentId}/full-record`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setRecord(d.record);
        else setError(d.error || 'No se pudo cargar el expediente.');
      })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setLoading(false));
  }, [studentId]);

  const s = record?.student;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold overflow-hidden">
              {s?.photo_url ? <img src={s.photo_url} alt="" className="w-full h-full object-cover" /> : s?.first_name?.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-slate-800">{s ? `${s.first_name} ${s.last_name}` : 'Expediente del Alumno'}</h2>
              <p className="text-xs text-slate-500">{s?.grade || 'Sin grado'} {s?.section ? `- ${s.section}` : ''} {s?.cedula ? `· Cédula: ${s.cedula}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-slate-200 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 py-16">
            <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Cargando expediente...
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-rose-500 py-16 text-sm">{error}</div>
        ) : record ? (
          <>
            <div className="flex border-b border-slate-200 overflow-x-auto bg-white">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 ${activeTab === tab.id ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  <tab.icon className="w-4 h-4 mr-1.5" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'general' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">DATOS DE ADMISIÓN / EXPEDIENTE</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <Field label="Nombre completo" value={`${s?.primer_nombre || s?.first_name || ''} ${s?.segundo_nombre || ''} ${s?.apellido_paterno || s?.last_name || ''} ${s?.apellido_materno || ''}`.replace(/\s+/g, ' ').trim()} />
                      <Field label="Cédula" value={s?.cedula} />
                      <Field label="Fecha de nacimiento" value={s?.birth_date} />
                      <Field label="Lugar de nacimiento" value={s?.birth_place} />
                      <Field label="Género" value={s?.gender} />
                      <Field label="Nacionalidad" value={s?.nationality} />
                      <Field label="Religión" value={s?.religion} />
                      <Field label="Colegio anterior" value={s?.previous_school} />
                      <Field label="Dirección" value={s?.address} />
                      <Field label="Email" value={s?.email} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">FICHA MÉDICA (Portal de Padres)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <Field label="Tipo de sangre" value={s?.blood_type} />
                      <Field label="Alergias" value={s?.allergies} />
                      <Field label="Condiciones médicas" value={s?.medical_conditions} />
                      <Field label="Medicamentos que toma" value={s?.takes_medication ? 'Sí' : 'No'} />
                      <Field label="Medicamentos autorizados en el colegio" value={s?.allowed_medications || s?.allowed_medications_other} />
                      <Field label="Requiere asistencia especial" value={s?.needs_assistance ? 'Sí' : 'No'} />
                      <Field label="Médico de cabecera" value={s?.primary_doctor} />
                      <Field label="Clínica" value={s?.clinic_name} />
                      <Field label="Teléfono clínica" value={s?.clinic_phone} />
                      <Field label="Vacunas al día" value={s?.vaccines_updated ? 'Sí' : 'No'} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">RESPONSABLES / PADRES</p>
                    {record.guardians.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin responsables vinculados.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {record.guardians.map((g, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-50 rounded-md border border-slate-200 px-3 py-2 text-sm">
                            <span className="font-semibold text-slate-700">{g.profiles?.first_name} {g.profiles?.last_name}</span>
                            <span className="text-slate-400">{g.profiles?.email} {g.profiles?.phone ? `· ${g.profiles.phone}` : ''}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 uppercase">{g.relationship}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'academico' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">MATRÍCULAS Y NOTAS FINALES POR AÑO LECTIVO</p>
                    {record.academicHistory.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin historial de matrículas todavía.</p>
                    ) : (
                      <div className="space-y-3">
                        {record.academicHistory.map(e => (
                          <div key={e.id} className="border border-slate-200 rounded-md overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                              <span className="font-semibold text-sm text-slate-700">{e.academic_terms?.name || 'Periodo'}</span>
                              <span className="text-xs text-slate-500 uppercase">{e.status}</span>
                            </div>
                            {e.class_enrollments.length === 0 ? (
                              <p className="p-3 text-xs text-slate-400">Sin grupos matriculados en este periodo.</p>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {e.class_enrollments.map((ce, i) => (
                                  <div key={i} className="px-3 py-1.5 flex items-center justify-between text-sm">
                                    <span className="text-slate-600">{ce.classes?.courses?.name || ce.classes?.name || 'Materia'}</span>
                                    <span className="font-bold text-slate-700">{ce.final_grade ?? '—'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">BOLETINES PUBLICADOS</p>
                    {record.reportCards.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin boletines publicados todavía.</p>
                    ) : (
                      <div className="space-y-3">
                        {record.reportCards.map(rc => (
                          <div key={rc.id} className="border border-slate-200 rounded-md overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                              <span className="font-semibold text-sm text-slate-700">{rc.academic_terms?.name || 'Periodo'}</span>
                              <span className="text-xs font-bold text-emerald-600">Índice: {rc.gpa ?? '—'}</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {rc.report_card_details.map((d, i) => (
                                <div key={i} className="px-3 py-1.5 flex items-center justify-between text-sm">
                                  <span className="text-slate-600">{d.classes?.name || 'Materia'}</span>
                                  <span className="font-bold text-slate-700">{d.final_score ?? '—'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'asistencia' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-2">
                    <StatTile label="Presente" value={record.attendance.summary.present} color="emerald" />
                    <StatTile label="Ausente" value={record.attendance.summary.absent} color="rose" />
                    <StatTile label="Tarde" value={record.attendance.summary.late} color="amber" />
                    <StatTile label="Justificado" value={record.attendance.summary.excused} color="slate" />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2 flex items-center"><ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> ALERTAS (ASISTENCIA, NOTAS, DISCIPLINA)</p>
                    {record.alerts.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin alertas registradas.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {record.alerts.map(a => (
                          <div key={a.id} className={`rounded-md border px-3 py-2 text-sm ${a.is_resolved ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-700 flex items-center"><AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> {a.type}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.is_resolved ? 'bg-slate-200 text-slate-500' : 'bg-amber-200 text-amber-700'}`}>
                                {a.is_resolved ? 'Resuelta' : `Riesgo ${a.risk_level}`}
                              </span>
                            </div>
                            <p className="text-slate-500 text-xs mt-1">{a.description}</p>
                            {a.resolution_notes && <p className="text-slate-400 text-xs mt-1 italic">Resolución: {a.resolution_notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">HISTORIAL DE ASISTENCIA</p>
                    {record.attendance.records.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin registros de asistencia todavía.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-md max-h-64 overflow-y-auto">
                        {record.attendance.records.map(r => (
                          <div key={r.id} className="px-3 py-1.5 flex items-center justify-between text-sm">
                            <span className="text-slate-500">{r.date} {r.classes ? `· ${r.classes.courses?.name || r.classes.name}` : '(diaria)'}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                              r.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                              r.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>{r.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'documentos' && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-2 flex items-center"><ClipboardList className="w-3.5 h-3.5 mr-1.5" /> DOCUMENTOS DEL EXPEDIENTE</p>
                  {record.documents.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin documentos cargados todavía.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {record.documents.map(d => (
                        <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-md border border-slate-200 px-3 py-2 text-sm">
                          <div>
                            <p className="font-semibold text-slate-700">{d.title || d.doc_type}</p>
                            <p className="text-xs text-slate-400">{d.doc_type} · {new Date(d.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {d.download_url && (
                              <a href={d.download_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-500 hover:text-slate-700">Ver</a>
                            )}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              d.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              d.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>{d.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'finanzas' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">FACTURAS EMITIDAS</p>
                    {record.invoices.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin facturas emitidas todavía.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {record.invoices.map(inv => (
                          <div key={inv.id} className="bg-slate-50 rounded-md border border-slate-200 px-3 py-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-700">{inv.invoice_number}</span>
                              <span className="font-bold text-slate-700">{money(inv.amount, inv.currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400 mt-0.5">
                              <span>Vence: {inv.due_date}</span>
                              <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                inv.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                              }`}>{inv.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">PAGOS REALIZADOS</p>
                    {record.payments.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin pagos registrados todavía.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {record.payments.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-md border border-slate-200 px-3 py-2 text-sm">
                            <span className="text-slate-600">{p.payment_date} · {p.invoices?.invoice_number || ''} · {p.method}</span>
                            <span className="font-bold text-emerald-600">{money(p.amount_paid)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div className="bg-slate-50 rounded-md border border-slate-200 px-3 py-1.5">
    <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
    <p className="text-slate-700">{value || '—'}</p>
  </div>
);

const STAT_TILE_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rose: 'bg-rose-50 border-rose-200 text-rose-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
};

const StatTile: React.FC<{ label: string; value: number; color: 'emerald' | 'rose' | 'amber' | 'slate' }> = ({ label, value, color }) => (
  <div className={`rounded-md border px-3 py-2 text-center ${STAT_TILE_COLORS[color]}`}>
    <p className="text-lg font-bold">{value}</p>
    <p className="text-[10px] font-bold uppercase opacity-80">{label}</p>
  </div>
);
