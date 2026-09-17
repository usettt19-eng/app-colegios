import React, { useState } from 'react';
import { ClipboardList, UserPlus, FileUp, FileSignature, CheckCircle2, Loader2, ArrowRight, Stethoscope, IdCard, GraduationCap as GradIcon, FileText } from 'lucide-react';

// Contexto de demostración: en producción tenant_id/parent_id vienen del token JWT de Supabase Auth (Fase 2)
const DEMO_TENANT_ID = 'tenant-demo-123';
const DEMO_PARENT_ID = 'parent-demo-123';
const DEMO_TERM_ID = 'term-demo-123';

type StepId = 1 | 2 | 3 | 4;

const DOC_TYPES: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: 'birth_certificate', label: 'Acta de Nacimiento', icon: <FileText className="w-4 h-4" /> },
  { value: 'previous_transcript', label: 'Notas del Colegio Anterior', icon: <GradIcon className="w-4 h-4" /> },
  { value: 'medical_record', label: 'Ficha Médica / Vacunas', icon: <Stethoscope className="w-4 h-4" /> },
  { value: 'identity_card', label: 'Cédula / Pasaporte', icon: <IdCard className="w-4 h-4" /> },
];

interface UploadedDoc {
  doc_type: string;
  title: string;
  status: string;
}

export const AdmissionsPortal: React.FC = () => {
  const [step, setStep] = useState<StepId>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [studentForm, setStudentForm] = useState({ first_name: '', last_name: '', grade: '', section: '' });
  const [studentId, setStudentId] = useState<string | null>(null);

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0].value);

  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState<string | null>(null);

  const handleCreateStudent = async () => {
    if (!studentForm.first_name || !studentForm.last_name) {
      setMessage('❌ Nombre y apellido son requeridos.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, parent_id: DEMO_PARENT_ID, ...studentForm }),
      });
      const data = await response.json();
      if (data.success) {
        setStudentId(data.student.id);
        setMessage('✅ Expediente del alumno creado exitosamente.');
        setStep(2);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el expediente.'));
      }
    } catch {
      setMessage('❌ Error de conexión al crear el expediente.');
    }
    setLoading(false);
  };

  const handleUploadDoc = async (fileName: string) => {
    if (!studentId) return;
    setLoading(true);
    setMessage('');
    try {
      const docTypeLabel = DOC_TYPES.find(d => d.value === selectedDocType)?.label || selectedDocType;
      // El archivo real se sube directo a Supabase Storage desde el cliente;
      // aquí solo registramos la referencia resultante en el expediente.
      const fakeFileUrl = `documents/${DEMO_TENANT_ID}/${studentId}/${selectedDocType}_${fileName}`;

      const response = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          student_id: studentId,
          uploader_id: DEMO_PARENT_ID,
          doc_type: selectedDocType,
          title: `${docTypeLabel} - ${fileName}`,
          file_url: fakeFileUrl,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setUploadedDocs(prev => [...prev, { doc_type: selectedDocType, title: data.document.title, status: data.document.status }]);
        setMessage(`✅ Documento "${docTypeLabel}" adjuntado. En espera de revisión.`);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo subir el documento.'));
      }
    } catch {
      setMessage('❌ Error de conexión al subir el documento.');
    }
    setLoading(false);
  };

  const handleEnroll = async () => {
    if (!studentId) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, student_id: studentId, term_id: DEMO_TERM_ID }),
      });
      const data = await response.json();
      if (data.success) {
        setEnrollmentId(data.enrollment.id);
        setMessage('✅ Matrícula registrada. Generando contrato de admisión...');

        const contractRes = await fetch('/api/v1/contracts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: DEMO_TENANT_ID,
            student_id: studentId,
            parent_id: DEMO_PARENT_ID,
            template_id: 'template-demo-123',
            enrollment_id: data.enrollment.id,
          }),
        });
        const contractData = await contractRes.json();
        if (contractData.success) {
          setContractUrl(contractData.contract_url);
          setMessage('✅ Matrícula y contrato generados exitosamente.');
        } else {
          setMessage('⚠️ Matrícula creada, pero el contrato no pudo generarse: ' + (contractData.error || 'error desconocido.'));
        }
        setStep(4);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar la matrícula.'));
      }
    } catch {
      setMessage('❌ Error de conexión al registrar la matrícula.');
    }
    setLoading(false);
  };

  const steps = [
    { id: 1, label: 'Datos del Alumno', icon: <UserPlus className="w-4 h-4" /> },
    { id: 2, label: 'Documentos', icon: <FileUp className="w-4 h-4" /> },
    { id: 3, label: 'Matrícula y Contrato', icon: <FileSignature className="w-4 h-4" /> },
    { id: 4, label: 'Resumen', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-slate-800">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 rounded-lg text-teal-700">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Portal de Admisiones</h1>
            <p className="text-sm text-slate-500">Proceso de matrícula para alumnos de primer ingreso</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-2 shrink-0 ${step === s.id ? 'text-teal-700' : step > s.id ? 'text-emerald-600' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 ${
                step === s.id ? 'border-teal-600 bg-teal-50' : step > s.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
              }`}>
                {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
              </div>
              <span className="text-sm font-bold hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 mx-3 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {message && (
        <div className="bg-teal-50 text-teal-800 p-4 rounded-lg flex items-start border border-teal-200 break-all">
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      {/* Step 1: Datos del Alumno */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><UserPlus className="w-4 h-4 mr-2 text-teal-600" /> Datos del Alumno Postulante</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text" placeholder="Nombre" value={studentForm.first_name}
              onChange={e => setStudentForm({ ...studentForm, first_name: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text" placeholder="Apellido" value={studentForm.last_name}
              onChange={e => setStudentForm({ ...studentForm, last_name: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text" placeholder="Grado (ej. 5to Primaria)" value={studentForm.grade}
              onChange={e => setStudentForm({ ...studentForm, grade: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text" placeholder="Sección" value={studentForm.section}
              onChange={e => setStudentForm({ ...studentForm, section: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleCreateStudent}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Crear Expediente y Continuar
          </button>
        </div>
      )}

      {/* Step 2: Documentos */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><FileUp className="w-4 h-4 mr-2 text-teal-600" /> Documentos Médicos y de Ingreso</h2>
          <p className="text-sm text-slate-500">Adjunta los documentos requeridos para completar el expediente del alumno.</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedDocType}
              onChange={e => setSelectedDocType(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <input
              type="file"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUploadDoc(file.name);
                e.target.value = '';
              }}
              disabled={loading}
              className="text-sm border border-slate-300 rounded-md px-3 py-2 flex-1"
            />
          </div>

          {uploadedDocs.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {uploadedDocs.map((doc, i) => (
                <div key={i} className="p-3 flex items-center justify-between text-sm bg-slate-50">
                  <span className="font-medium text-slate-700">{doc.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{doc.status}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setStep(3)}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold"
          >
            <ArrowRight className="w-4 h-4 mr-2" /> Continuar a Matrícula
          </button>
        </div>
      )}

      {/* Step 3: Matrícula y Contrato */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><FileSignature className="w-4 h-4 mr-2 text-teal-600" /> Matrícula y Firma de Contrato</h2>
          <p className="text-sm text-slate-500">
            Al confirmar, se registrará la matrícula del alumno en el ciclo actual y se generará el contrato de admisión para firma electrónica.
          </p>
          <button
            onClick={handleEnroll}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Confirmar Matrícula y Generar Contrato
          </button>
        </div>
      )}

      {/* Step 4: Resumen */}
      {step === 4 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6 mr-2" />
            <h2 className="font-bold text-lg">Proceso de Admisión Completado</h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-400">Alumno</dt>
              <dd className="font-semibold">{studentForm.first_name} {studentForm.last_name}</dd>
            </div>
            <div>
              <dt className="text-slate-400">ID de Expediente</dt>
              <dd className="font-mono text-xs">{studentId}</dd>
            </div>
            <div>
              <dt className="text-slate-400">ID de Matrícula</dt>
              <dd className="font-mono text-xs">{enrollmentId || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Documentos Adjuntados</dt>
              <dd className="font-semibold">{uploadedDocs.length}</dd>
            </div>
          </dl>
          {contractUrl && (
            <a
              href={contractUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-semibold"
            >
              <FileSignature className="w-4 h-4 mr-2" /> Ver Contrato Generado
            </a>
          )}
        </div>
      )}
    </div>
  );
};
