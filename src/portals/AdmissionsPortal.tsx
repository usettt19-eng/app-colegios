import React, { useEffect, useState } from 'react';
import { ClipboardList, UserPlus, FileUp, FileSignature, CheckCircle2, Loader2, ArrowRight, Stethoscope, IdCard, GraduationCap as GradIcon, FileText, Camera, Search } from 'lucide-react';
import { AdmissionsCRM } from './AdmissionsCRM';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Contexto de demostración: en producción tenant_id viene del token JWT de Supabase Auth (Fase 2)
const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_TERM_ID = '55555555-5555-5555-5555-555555555555';

const RELATIONSHIPS = [
  { value: 'madre', label: 'Madre' },
  { value: 'padre', label: 'Padre' },
  { value: 'acudiente', label: 'Acudiente' },
];

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
  download_url?: string | null;
}

interface GradeLevel {
  id: string;
  name: string;
  grade_sections: { id: string; name: string }[];
}

export const AdmissionsPortal: React.FC = () => {
  const [mode, setMode] = useState<'pipeline' | 'matricula'>('pipeline');
  const [convertingProspectId, setConvertingProspectId] = useState<string | null>(null);
  const [prefillNote, setPrefillNote] = useState('');

  const [step, setStep] = useState<StepId>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [studentForm, setStudentForm] = useState({
    first_name: '', last_name: '', grade_section_id: '',
    cedula: '', birth_date: '', previous_school: '', address: '',
  });
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [resolvedParentId, setResolvedParentId] = useState<string | null>(null);

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [selectedGradeLevelId, setSelectedGradeLevelId] = useState('');

  const handleStartMatriculaFromProspect = (prospect: {
    id: string; student_first_name: string; student_last_name: string;
    desired_grade_level_id: string | null; parent_name: string | null; parent_email: string | null; parent_phone: string | null;
  }) => {
    setStep(1);
    setStudentId(null);
    setResolvedParentId(null);
    setStudentPhoto(null);
    setStudentForm({
      first_name: prospect.student_first_name, last_name: prospect.student_last_name,
      grade_section_id: '', cedula: '', birth_date: '', previous_school: '', address: '',
    });
    setSelectedGradeLevelId(prospect.desired_grade_level_id || '');
    setConvertingProspectId(prospect.id);
    const contactParts = [prospect.parent_name, prospect.parent_email, prospect.parent_phone].filter(Boolean);
    setPrefillNote(contactParts.length > 0 ? `Contacto del prospecto: ${contactParts.join(' · ')}. Vincula o crea a este responsable abajo.` : '');
    setMode('matricula');
  };

  useEffect(() => {
    fetch(`/api/v1/grade-settings/levels?tenant_id=${DEMO_TENANT_ID}`)
      .then(r => r.json())
      .then(d => setGradeLevels(d.gradeLevels || []))
      .catch(() => {});
  }, []);

  const availableSections = gradeLevels.find(g => g.id === selectedGradeLevelId)?.grade_sections || [];

  // --- Padre / Madre / Acudiente (hasta 3 responsables, todos opcionales) ---
  interface ParentSuggestion { id: string; first_name: string; last_name: string; email: string }
  interface GuardianSlot {
    search: string;
    suggestions: ParentSuggestion[];
    selected: ParentSuggestion | null;
    creating: boolean;
    newForm: { first_name: string; last_name: string; email: string; phone: string; cedula: string; password: string };
  }
  const emptyGuardianSlot = (): GuardianSlot => ({
    search: '', suggestions: [], selected: null, creating: false,
    newForm: { first_name: '', last_name: '', email: '', phone: '', cedula: '', password: '' },
  });
  const [guardianSlots, setGuardianSlots] = useState<Record<'madre' | 'padre' | 'acudiente', GuardianSlot>>({
    madre: emptyGuardianSlot(), padre: emptyGuardianSlot(), acudiente: emptyGuardianSlot(),
  });
  const updateGuardianSlot = (rel: 'madre' | 'padre' | 'acudiente', patch: Partial<GuardianSlot>) => {
    setGuardianSlots(prev => ({ ...prev, [rel]: { ...prev[rel], ...patch } }));
  };

  const useGuardianSearch = (rel: 'madre' | 'padre' | 'acudiente') => {
    const slot = guardianSlots[rel];
    useEffect(() => {
      if (!slot.search || slot.selected) {
        if (slot.suggestions.length > 0) updateGuardianSlot(rel, { suggestions: [] });
        return;
      }
      const timeout = setTimeout(() => {
        fetch(`/api/v1/profiles?tenant_id=${DEMO_TENANT_ID}&role=parent&search=${encodeURIComponent(slot.search)}`)
          .then(r => r.json())
          .then(d => updateGuardianSlot(rel, { suggestions: d.profiles || [] }))
          .catch(() => {});
      }, 300);
      return () => clearTimeout(timeout);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slot.search, slot.selected]);
  };
  useGuardianSearch('madre');
  useGuardianSearch('padre');
  useGuardianSearch('acudiente');

  const handlePhotoSelected = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setStudentPhoto(dataUrl);
    } catch {
      setMessage('❌ No se pudo leer la foto seleccionada.');
    }
  };

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0].value);

  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState<string | null>(null);

  const handleCreateStudent = async () => {
    if (!studentForm.first_name || !studentForm.last_name) {
      setMessage('❌ Nombre y apellido son requeridos.');
      return;
    }
    const relations: ('madre' | 'padre' | 'acudiente')[] = ['madre', 'padre', 'acudiente'];
    const hasAnyGuardian = relations.some(rel => guardianSlots[rel].selected || guardianSlots[rel].creating);
    if (!hasAnyGuardian) {
      setMessage('❌ Vincula al menos un responsable (madre, padre o acudiente).');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const guardianLinks: { parent_id: string; relationship: string }[] = [];

      for (const rel of relations) {
        const slot = guardianSlots[rel];
        if (slot.selected) {
          guardianLinks.push({ parent_id: slot.selected.id, relationship: rel });
        } else if (slot.creating) {
          if (!slot.newForm.first_name || !slot.newForm.last_name || !slot.newForm.email || !slot.newForm.password) {
            setMessage(`❌ Completa todos los campos del/de la ${rel} nuevo(a).`);
            setLoading(false);
            return;
          }
          const createRes = await fetch('/api/v1/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, role: 'parent', ...slot.newForm }),
          });
          const createData = await createRes.json();
          if (!createData.success) {
            setMessage(`❌ No se pudo crear el/la ${rel}: ` + (createData.error || ''));
            setLoading(false);
            return;
          }
          guardianLinks.push({ parent_id: createData.profile.id, relationship: rel });
        }
      }

      const response = await fetch('/api/v1/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          guardians: guardianLinks,
          photo_url: studentPhoto,
          ...studentForm,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setStudentId(data.student.id);
        setResolvedParentId(guardianLinks[0]?.parent_id || null);
        setMessage('✅ Expediente del alumno creado exitosamente.');
        setStep(2);
        if (convertingProspectId) {
          fetch(`/api/v1/admissions-crm/prospects/${convertingProspectId}/link-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: data.student.id }),
          }).catch(() => {});
          setConvertingProspectId(null);
        }
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el expediente.'));
      }
    } catch {
      setMessage('❌ Error de conexión al crear el expediente.');
    }
    setLoading(false);
  };

  const handleUploadDoc = async (file: File) => {
    if (!studentId) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage('❌ El archivo supera el máximo permitido (10MB).');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const docTypeLabel = DOC_TYPES.find(d => d.value === selectedDocType)?.label || selectedDocType;
      const fileData = await readFileAsDataUrl(file);

      const response = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          student_id: studentId,
          uploader_id: resolvedParentId,
          doc_type: selectedDocType,
          title: `${docTypeLabel} - ${file.name}`,
          file_data: fileData,
          file_name: file.name,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setUploadedDocs(prev => [...prev, { doc_type: selectedDocType, title: data.document.title, status: data.document.status, download_url: data.document.download_url }]);
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
            parent_id: resolvedParentId,
            template_id: '77777777-7777-7777-7777-777777777777',
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
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setMode('pipeline')}
            className={`px-3 py-1.5 rounded-md text-sm font-bold ${mode === 'pipeline' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pipeline de Prospectos
          </button>
          <button
            onClick={() => setMode('matricula')}
            className={`px-3 py-1.5 rounded-md text-sm font-bold ${mode === 'matricula' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Matricular Alumno
          </button>
        </div>
      </div>

      {mode === 'pipeline' && (
        <AdmissionsCRM tenantId={DEMO_TENANT_ID} onConvert={handleStartMatriculaFromProspect} />
      )}

      {mode === 'matricula' && (
      <>
      {prefillNote && (
        <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 text-sm">{prefillNote}</div>
      )}

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

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {studentPhoto ? (
                <img src={studentPhoto} alt="Foto del alumno" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-slate-300" />
              )}
            </div>
            <div>
              <label className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-sm font-semibold cursor-pointer">
                <Camera className="w-4 h-4 mr-2" /> Subir Foto del Alumno
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={e => handlePhotoSelected(e.target.files?.[0])}
                />
              </label>
              <p className="text-xs text-slate-400 mt-1">Se guarda en el expediente del alumno.</p>
            </div>
          </div>

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
            <select
              value={selectedGradeLevelId}
              onChange={e => { setSelectedGradeLevelId(e.target.value); setStudentForm({ ...studentForm, grade_section_id: '' }); }}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Selecciona el grado...</option>
              {gradeLevels.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select
              value={studentForm.grade_section_id}
              onChange={e => setStudentForm({ ...studentForm, grade_section_id: e.target.value })}
              disabled={!selectedGradeLevelId}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            >
              <option value="">Selecciona la sección...</option>
              {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {gradeLevels.length === 0 && (
            <p className="text-xs text-amber-600">
              Este colegio todavía no tiene grados/secciones configurados. Créalos desde el Portal Administrativo (Grados y Secciones).
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text" placeholder="Cédula / Identificación" value={studentForm.cedula}
              onChange={e => setStudentForm({ ...studentForm, cedula: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha de nacimiento</label>
              <input
                type="date" value={studentForm.birth_date}
                onChange={e => setStudentForm({ ...studentForm, birth_date: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <input
              type="text" placeholder="Colegio de procedencia" value={studentForm.previous_school}
              onChange={e => setStudentForm({ ...studentForm, previous_school: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text" placeholder="Dirección" value={studentForm.address}
              onChange={e => setStudentForm({ ...studentForm, address: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {RELATIONSHIPS.map(({ value: rel, label }) => {
            const slot = guardianSlots[rel as 'madre' | 'padre' | 'acudiente'];
            const key = rel as 'madre' | 'padre' | 'acudiente';
            return (
              <div key={rel} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-600 flex items-center"><UserPlus className="w-4 h-4 mr-1.5 text-teal-600" /> {label} (opcional)</h3>

                {slot.selected ? (
                  <div className="flex items-center justify-between bg-white rounded-md border border-teal-200 px-3 py-2">
                    <span className="text-sm">
                      <span className="font-semibold text-slate-700">{slot.selected.first_name} {slot.selected.last_name}</span>
                      <span className="text-slate-400 ml-2">{slot.selected.email}</span>
                    </span>
                    <button onClick={() => updateGuardianSlot(key, { selected: null })} className="text-xs font-bold text-rose-600 hover:text-rose-800">Quitar</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text" placeholder={`Buscar ${label.toLowerCase()} existente por nombre o email...`} value={slot.search}
                      onChange={e => updateGuardianSlot(key, { search: e.target.value })}
                      className="w-full border border-slate-300 rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {slot.suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {slot.suggestions.map(p => (
                          <button
                            key={p.id}
                            onClick={() => updateGuardianSlot(key, { selected: p, search: '', suggestions: [] })}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                          >
                            {p.first_name} {p.last_name} <span className="text-slate-400">({p.email})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!slot.selected && (
                  <button
                    onClick={() => updateGuardianSlot(key, { creating: !slot.creating })}
                    className="text-xs font-bold text-teal-600 hover:text-teal-800 text-left"
                  >
                    {slot.creating ? 'Cancelar y buscar existente' : `${label} no está registrado(a): crear nuevo`}
                  </button>
                )}

                {!slot.selected && slot.creating && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text" placeholder="Nombre" value={slot.newForm.first_name}
                      onChange={e => updateGuardianSlot(key, { newForm: { ...slot.newForm, first_name: e.target.value } })}
                      className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text" placeholder="Apellido" value={slot.newForm.last_name}
                      onChange={e => updateGuardianSlot(key, { newForm: { ...slot.newForm, last_name: e.target.value } })}
                      className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="email" placeholder="Correo electrónico" value={slot.newForm.email}
                      onChange={e => updateGuardianSlot(key, { newForm: { ...slot.newForm, email: e.target.value } })}
                      className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text" placeholder="Teléfono" value={slot.newForm.phone}
                      onChange={e => updateGuardianSlot(key, { newForm: { ...slot.newForm, phone: e.target.value } })}
                      className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text" placeholder="Cédula" value={slot.newForm.cedula}
                      onChange={e => updateGuardianSlot(key, { newForm: { ...slot.newForm, cedula: e.target.value } })}
                      className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text" placeholder="Contraseña temporal" value={slot.newForm.password}
                      onChange={e => updateGuardianSlot(key, { newForm: { ...slot.newForm, password: e.target.value } })}
                      className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}
              </div>
            );
          })}

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
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUploadDoc(file);
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

          {studentPhoto && (
            <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-200">
              <img src={studentPhoto} alt="Foto del alumno" className="w-full h-full object-cover" />
            </div>
          )}

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
      </>
      )}
    </div>
  );
};
