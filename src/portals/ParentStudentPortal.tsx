import React, { useEffect, useState } from 'react';
import { GraduationCap, FileText, CreditCard, FileSignature, CheckCircle, AlertTriangle, Download, Loader2, Car, UserCheck, Plus, Camera, UserCircle2, BarChart3 } from 'lucide-react';
import { StudentMedicalRecord } from './StudentMedicalRecord';
import { ParentDashboard } from './ParentDashboard';
import { PaymentCenter } from './PaymentCenter';
import { GuardianInfoForm } from './GuardianInfoForm';

// Contexto de demostración: en producción estos IDs vienen del token JWT de Supabase Auth (Fase 2)
const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_STUDENT_ID = '22222222-2222-2222-2222-222222222222';
const DEMO_PARENT_ID = '33333333-3333-3333-3333-333333333333';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type TabId = 'dashboard' | 'grades' | 'bulletins' | 'contracts' | 'payments' | 'pickup' | 'profile';

interface ReplacementRequest {
  id: string;
  replacement_name: string;
  replacement_phone: string;
  status: string;
  is_recurring: boolean;
}

interface CarpoolAuthorization {
  id: string;
  day_of_week: number;
  driver_parent_id: string;
}

interface CarpoolOverride {
  id: string;
  override_date: string;
  driver_parent_id: string;
}

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

export const ParentStudentPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // --- Recogida y Carpool ---
  const [replacements, setReplacements] = useState<ReplacementRequest[]>([]);
  const [carpoolAuths, setCarpoolAuths] = useState<CarpoolAuthorization[]>([]);
  const [carpoolOverrides, setCarpoolOverrides] = useState<CarpoolOverride[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [replacementForm, setReplacementForm] = useState({ replacement_name: '', replacement_phone: '', is_recurring: true });
  const [carpoolForm, setCarpoolForm] = useState({ driver_parent_id: '', day_of_week: '1' });
  const [overrideForm, setOverrideForm] = useState({ driver_parent_id: '', override_date: '' });

  // --- Perfil ("Actualización de Datos"): Estudiante | Madre | Padre | Acudiente | Información Adicional ---
  type ProfileSubTab = 'estudiante' | 'madre' | 'padre' | 'acudiente' | 'adicional';
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>('estudiante');
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [guardianIds, setGuardianIds] = useState<{ madre: string | null; padre: string | null; acudiente: string | null }>({
    madre: null, padre: null, acudiente: null,
  });

  const loadGuardians = async () => {
    try {
      const response = await fetch(`/api/v1/students/${DEMO_STUDENT_ID}/guardians`);
      const data = await response.json();
      const guardians = data.guardians || [];
      const find = (rel: string) => guardians.find((g: any) => g.relationship === rel)?.profiles?.id || null;
      setGuardianIds({ madre: find('madre'), padre: find('padre'), acudiente: find('acudiente') });
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  const [studentInfoLoading, setStudentInfoLoading] = useState(false);
  const [studentInfoForm, setStudentInfoForm] = useState({
    cedula: '', apellido_paterno: '', apellido_materno: '', primer_nombre: '', segundo_nombre: '',
    birth_date: '', gender: '', nationality: '', birth_place: '', religion: '', baptized: true,
    previous_school: '', email: '', address: '',
  });

  const studentAge = studentInfoForm.birth_date
    ? Math.floor((Date.now() - new Date(studentInfoForm.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const loadProfilePhotos = async () => {
    try {
      const studentRes = await fetch(`/api/v1/students/${DEMO_STUDENT_ID}`);
      const studentData = await studentRes.json();
      setStudentPhoto(studentData.student?.photo_url || null);
      const s = studentData.student;
      if (s) {
        setStudentInfoForm({
          cedula: s.cedula || '',
          apellido_paterno: s.apellido_paterno || '',
          apellido_materno: s.apellido_materno || '',
          primer_nombre: s.primer_nombre || '',
          segundo_nombre: s.segundo_nombre || '',
          birth_date: s.birth_date || '',
          gender: s.gender || '',
          nationality: s.nationality || '',
          birth_place: s.birth_place || '',
          religion: s.religion || '',
          baptized: s.baptized ?? true,
          previous_school: s.previous_school || '',
          email: s.email || '',
          address: s.address || '',
        });
      }
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  const handleSaveStudentInfo = async () => {
    setStudentInfoLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/students/${DEMO_STUDENT_ID}/general-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentInfoForm),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Datos generales del alumno actualizados.');
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo guardar la información.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setStudentInfoLoading(false);
  };

  const handleUploadStudentPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoLoading(true);
    setMessage('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch(`/api/v1/students/${DEMO_STUDENT_ID}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, photo_url: dataUrl }),
      });
      const data = await response.json();
      if (data.success) {
        setStudentPhoto(data.student?.photo_url || dataUrl);
        setMessage('✅ Foto del alumno actualizada.');
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo actualizar la foto.'));
      }
    } catch {
      setMessage('❌ Error al subir la foto.');
    }
    setPhotoLoading(false);
  };

  const loadPickupData = async () => {
    try {
      const [replacementsRes, carpoolRes, overridesRes] = await Promise.all([
        fetch(`/api/v1/pickup/replacements?tenant_id=${DEMO_TENANT_ID}&parent_id=${DEMO_PARENT_ID}`),
        fetch(`/api/v1/pickup/carpool/authorizations?tenant_id=${DEMO_TENANT_ID}&student_id=${DEMO_STUDENT_ID}`),
        fetch(`/api/v1/pickup/carpool/overrides?tenant_id=${DEMO_TENANT_ID}&student_id=${DEMO_STUDENT_ID}`),
      ]);
      const replacementsData = await replacementsRes.json();
      const carpoolData = await carpoolRes.json();
      const overridesData = await overridesRes.json();
      setReplacements(replacementsData.replacements || []);
      setCarpoolAuths(carpoolData.authorizations || []);
      setCarpoolOverrides(overridesData.overrides || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  useEffect(() => {
    if (activeTab === 'pickup') loadPickupData();
    if (activeTab === 'profile') {
      loadProfilePhotos();
      loadGuardians();
    }
  }, [activeTab]);

  const handleCreateReplacement = async () => {
    if (!replacementForm.replacement_name || !replacementForm.replacement_phone) {
      setMessage('❌ Indica el nombre y teléfono de la persona autorizada.');
      return;
    }
    setPickupLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/pickup/replacements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          parent_id: DEMO_PARENT_ID,
          student_ids: [DEMO_STUDENT_ID],
          ...replacementForm,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Solicitud de reemplazo enviada, pendiente de aprobación del colegio.');
        setReplacementForm({ replacement_name: '', replacement_phone: '', is_recurring: true });
        loadPickupData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar la solicitud.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setPickupLoading(false);
  };

  const handleCreateCarpool = async () => {
    if (!carpoolForm.driver_parent_id) {
      setMessage('❌ Indica el ID del padre que recogerá en carpool.');
      return;
    }
    setPickupLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/pickup/carpool/authorizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          student_id: DEMO_STUDENT_ID,
          authorizing_parent_id: DEMO_PARENT_ID,
          driver_parent_id: carpoolForm.driver_parent_id,
          day_of_week: Number(carpoolForm.day_of_week),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Autorización de carpool creada.');
        setCarpoolForm({ driver_parent_id: '', day_of_week: '1' });
        loadPickupData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear la autorización.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setPickupLoading(false);
  };

  const handleCreateOverride = async () => {
    if (!overrideForm.driver_parent_id || !overrideForm.override_date) {
      setMessage('❌ Indica el conductor y la fecha de la excepción.');
      return;
    }
    setPickupLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/pickup/carpool/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          student_id: DEMO_STUDENT_ID,
          authorizing_parent_id: DEMO_PARENT_ID,
          driver_parent_id: overrideForm.driver_parent_id,
          override_date: overrideForm.override_date,
          created_by: DEMO_PARENT_ID,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Excepción de carpool registrada para ese día.');
        setOverrideForm({ driver_parent_id: '', override_date: '' });
        loadPickupData();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar la excepción.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setPickupLoading(false);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [enrollmentsRes, bulletinsRes] = await Promise.all([
          fetch(`/api/v1/enrollments/${DEMO_STUDENT_ID}`),
          fetch(`/api/v1/bulletins/${DEMO_STUDENT_ID}`),
        ]);

        const enrollmentsData = await enrollmentsRes.json();
        const bulletinsData = await bulletinsRes.json();

        setEnrollments(enrollmentsData.enrollments || []);
        setReportCards(bulletinsData.reportCards || []);
      } catch (error) {
        setMessage('❌ No se pudo conectar con el servidor SIS.');
      }
      setLoading(false);
    };
    loadData();
  }, []);

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
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'dashboard' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <BarChart3 className="w-4 h-4 mr-2" /> Inicio
        </button>
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
          <CreditCard className="w-4 h-4 mr-2" /> Centro de Pagos
        </button>
        <button
          onClick={() => setActiveTab('pickup')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'pickup' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Car className="w-4 h-4 mr-2" /> Recogida y Carpool
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'profile' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <UserCircle2 className="w-4 h-4 mr-2" /> Perfil
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Cargando información del SIS...
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <ParentDashboard
              tenantId={DEMO_TENANT_ID}
              studentId={DEMO_STUDENT_ID}
              onGoToPayments={() => setActiveTab('payments')}
              onGoToAgenda={() => setActiveTab('bulletins')}
              onGoToGrades={() => setActiveTab('grades')}
            />
          )}

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

          {activeTab === 'payments' && <PaymentCenter studentId={DEMO_STUDENT_ID} />}

          {activeTab === 'pickup' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
                  <h2 className="font-bold text-slate-700 flex items-center"><UserCheck className="w-4 h-4 mr-2 text-purple-600" /> Autorizar Reemplazo</h2>
                  <p className="text-xs text-slate-500">Autoriza a un tercero (que no es padre registrado) a recoger a tu hijo.</p>
                  <input
                    type="text" placeholder="Nombre completo" value={replacementForm.replacement_name}
                    onChange={e => setReplacementForm({ ...replacementForm, replacement_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="text" placeholder="Teléfono" value={replacementForm.replacement_phone}
                    onChange={e => setReplacementForm({ ...replacementForm, replacement_phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox" checked={replacementForm.is_recurring}
                      onChange={e => setReplacementForm({ ...replacementForm, is_recurring: e.target.checked })}
                    />
                    Autorización recurrente (no solo por hoy)
                  </label>
                  <button
                    onClick={handleCreateReplacement}
                    disabled={pickupLoading}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-semibold text-sm"
                  >
                    {pickupLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Enviar Solicitud
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
                  <h2 className="font-bold text-slate-700 flex items-center"><Car className="w-4 h-4 mr-2 text-purple-600" /> Autorizar Carpool</h2>
                  <p className="text-xs text-slate-500">Autoriza a otro padre registrado a recoger a tu hijo un día fijo de la semana.</p>
                  <input
                    type="text" placeholder="ID de perfil del padre conductor" value={carpoolForm.driver_parent_id}
                    onChange={e => setCarpoolForm({ ...carpoolForm, driver_parent_id: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <select
                    value={carpoolForm.day_of_week}
                    onChange={e => setCarpoolForm({ ...carpoolForm, day_of_week: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <button
                    onClick={handleCreateCarpool}
                    disabled={pickupLoading}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-semibold text-sm"
                  >
                    {pickupLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Autorizar Carpool
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
                  <h2 className="font-bold text-slate-700 flex items-center"><Car className="w-4 h-4 mr-2 text-purple-600" /> Excepción de Carpool (1 día)</h2>
                  <p className="text-xs text-slate-500">Para un día puntual, alguien distinto al carpool recurrente recogerá a tu hijo.</p>
                  <input
                    type="text" placeholder="ID de perfil del padre conductor" value={overrideForm.driver_parent_id}
                    onChange={e => setOverrideForm({ ...overrideForm, driver_parent_id: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="date" value={overrideForm.override_date}
                    onChange={e => setOverrideForm({ ...overrideForm, override_date: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleCreateOverride}
                    disabled={pickupLoading}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-semibold text-sm"
                  >
                    {pickupLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Registrar Excepción
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h2 className="font-bold text-slate-700">Reemplazos Autorizados</h2>
                </div>
                {replacements.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">Aún no has autorizado a nadie más para recoger a tu hijo.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {replacements.map(r => (
                      <div key={r.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-700">{r.replacement_name}</p>
                          <p className="text-xs text-slate-500">{r.replacement_phone} {r.is_recurring && '· Recurrente'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusBadge(r.status)}`}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h2 className="font-bold text-slate-700">Autorizaciones de Carpool</h2>
                </div>
                {carpoolAuths.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">Aún no hay autorizaciones de carpool configuradas.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {carpoolAuths.map(c => (
                      <div key={c.id} className="p-4 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{DAYS[c.day_of_week]}</span>
                        <span className="text-slate-500 font-mono text-xs">Conductor: {c.driver_parent_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h2 className="font-bold text-slate-700">Excepciones de Carpool</h2>
                </div>
                {carpoolOverrides.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">Aún no hay excepciones de carpool registradas.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {carpoolOverrides.map(o => (
                      <div key={o.id} className="p-4 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{o.override_date}</span>
                        <span className="text-slate-500 font-mono text-xs">Conductor: {o.driver_parent_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-xl font-bold text-slate-800">Actualización de Datos</h1>
              </div>

              <div className="flex flex-wrap justify-center gap-2 border-b border-slate-200 pb-3">
                {([
                  ['estudiante', 'Estudiante'],
                  ['madre', 'Madre'],
                  ['padre', 'Padre'],
                  ['acudiente', 'Acudiente'],
                ] as [ProfileSubTab, string][]).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setProfileSubTab(tab)}
                    className={`px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wide transition-colors ${profileSubTab === tab ? 'text-purple-700 border-b-2 border-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setProfileSubTab('adicional')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${profileSubTab === 'adicional' ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}
                >
                  Información Adicional
                </button>
              </div>

              {profileSubTab === 'estudiante' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3 text-center max-w-xs mx-auto">
                    <h2 className="font-bold text-slate-700 flex items-center justify-center"><GraduationCap className="w-4 h-4 mr-2 text-purple-600" /> Foto del Alumno</h2>
                    <div className="w-28 h-28 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center mx-auto">
                      {studentPhoto ? (
                        <img src={studentPhoto} alt="Foto del alumno" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <label className="inline-flex items-center px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-sm font-semibold cursor-pointer">
                      {photoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                      Actualizar Foto
                      <input
                        type="file" accept="image/*" className="hidden" disabled={photoLoading}
                        onChange={e => handleUploadStudentPhoto(e.target.files?.[0])}
                      />
                    </label>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-3 bg-blue-600">
                      <h2 className="font-bold text-white">Datos Generales</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Cédula</label>
                        <input value={studentInfoForm.cedula} onChange={e => setStudentInfoForm({ ...studentInfoForm, cedula: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <span className="block text-xs text-slate-500 mb-1">Edad</span>
                        <p className="px-3 py-2 text-slate-700">{studentAge ?? '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Apellido Paterno</label>
                        <input value={studentInfoForm.apellido_paterno} onChange={e => setStudentInfoForm({ ...studentInfoForm, apellido_paterno: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Apellido Materno</label>
                        <input value={studentInfoForm.apellido_materno} onChange={e => setStudentInfoForm({ ...studentInfoForm, apellido_materno: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Primer Nombre</label>
                        <input value={studentInfoForm.primer_nombre} onChange={e => setStudentInfoForm({ ...studentInfoForm, primer_nombre: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Segundo Nombre</label>
                        <input value={studentInfoForm.segundo_nombre} onChange={e => setStudentInfoForm({ ...studentInfoForm, segundo_nombre: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-3 bg-blue-600">
                      <h2 className="font-bold text-white">Información General</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Fecha Nacimiento</label>
                        <input type="date" value={studentInfoForm.birth_date} onChange={e => setStudentInfoForm({ ...studentInfoForm, birth_date: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Género</label>
                        <select value={studentInfoForm.gender} onChange={e => setStudentInfoForm({ ...studentInfoForm, gender: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                          <option value="">Selecciona...</option>
                          <option value="FEMENINO">Femenino</option>
                          <option value="MASCULINO">Masculino</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Nacionalidad</label>
                        <input value={studentInfoForm.nationality} onChange={e => setStudentInfoForm({ ...studentInfoForm, nationality: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Lugar de Nacimiento</label>
                        <input value={studentInfoForm.birth_place} onChange={e => setStudentInfoForm({ ...studentInfoForm, birth_place: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Religión</label>
                        <input value={studentInfoForm.religion} onChange={e => setStudentInfoForm({ ...studentInfoForm, religion: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <span className="block text-xs text-slate-500 mb-1">Bautizado</span>
                        <div className="flex items-center gap-4 px-1 py-2">
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input type="radio" checked={studentInfoForm.baptized === true} onChange={() => setStudentInfoForm({ ...studentInfoForm, baptized: true })} /> Sí
                          </label>
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input type="radio" checked={studentInfoForm.baptized === false} onChange={() => setStudentInfoForm({ ...studentInfoForm, baptized: false })} /> No
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Escuela de Procedencia</label>
                        <input value={studentInfoForm.previous_school} onChange={e => setStudentInfoForm({ ...studentInfoForm, previous_school: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Correo Electrónico</label>
                        <input type="email" value={studentInfoForm.email} onChange={e => setStudentInfoForm({ ...studentInfoForm, email: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Dirección</label>
                        <input value={studentInfoForm.address} onChange={e => setStudentInfoForm({ ...studentInfoForm, address: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="px-6 pb-6">
                      <button onClick={handleSaveStudentInfo} disabled={studentInfoLoading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm">
                        {studentInfoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Guardar Datos del Alumno
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {profileSubTab === 'madre' && (
                <GuardianInfoForm tenantId={DEMO_TENANT_ID} profileId={guardianIds.madre} label="Madre" onMessage={setMessage} />
              )}
              {profileSubTab === 'padre' && (
                <GuardianInfoForm tenantId={DEMO_TENANT_ID} profileId={guardianIds.padre} label="Padre" onMessage={setMessage} />
              )}
              {profileSubTab === 'acudiente' && (
                <GuardianInfoForm tenantId={DEMO_TENANT_ID} profileId={guardianIds.acudiente} label="Acudiente" onMessage={setMessage} />
              )}
              {profileSubTab === 'adicional' && (
                <StudentMedicalRecord
                  tenantId={DEMO_TENANT_ID}
                  studentId={DEMO_STUDENT_ID}
                  requesterId={DEMO_PARENT_ID}
                  onMessage={setMessage}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
