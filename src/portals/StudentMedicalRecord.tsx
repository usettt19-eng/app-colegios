import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, HeartPulse, Syringe, ShieldAlert, UserCheck2, Upload, Eye } from 'lucide-react';

const VACCINE_OPTIONS = [
  'Papiloma Virus', 'Tdap', 'Influenza', 'Covid-19 (Pfizer)', 'Hepatitis A', 'Hepatitis B',
  'Triple Viral (SRP)', 'Varicela', 'Fiebre Amarilla', 'Neumococo', 'Otra',
];
const DOSE_OPTIONS = ['1era Dosis', '2da Dosis', '3era Dosis', 'Refuerzo'];
const MEDICATION_OPTIONS = ['Pepto Bismol', 'Panadol líquido', 'Panadol pastillas', 'Ibuprofeno (Dorival)', 'Gasol'];

interface PersonEntry {
  id: string;
  name: string;
  cedula: string | null;
  relationship: string | null;
  phone: string | null;
}

interface VaccineEntry {
  id: string;
  vaccine_name: string;
  dose: string | null;
  date: string | null;
}

interface HealthCard {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
}

interface Props {
  tenantId: string;
  studentId: string;
  requesterId: string;
  onMessage: (msg: string) => void;
}

const emptyPersonForm = { name: '', cedula: '', relationship: '', phone: '' };

export const StudentMedicalRecord: React.FC<Props> = ({ tenantId, studentId, requesterId, onMessage }) => {
  const [loading, setLoading] = useState(false);

  const [emergencyContacts, setEmergencyContacts] = useState<PersonEntry[]>([]);
  const [emergencyForm, setEmergencyForm] = useState(emptyPersonForm);

  const [authorizedPickups, setAuthorizedPickups] = useState<PersonEntry[]>([]);
  const [authorizedForm, setAuthorizedForm] = useState(emptyPersonForm);

  const [health, setHealth] = useState({
    blood_type: '', height_cm: '', weight_lbs: '', primary_doctor: '', clinic_name: '', clinic_phone: '',
    takes_medication: '', needs_assistance: '', allergies: '', medical_conditions: '', vaccines_updated: '',
    allowed_medications: [] as string[], allowed_medications_other: '',
  });

  const [vaccines, setVaccines] = useState<VaccineEntry[]>([]);
  const [vaccineForm, setVaccineForm] = useState({ vaccine_name: VACCINE_OPTIONS[0], dose: DOSE_OPTIONS[0], date: '' });

  const [cards, setCards] = useState<HealthCard[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [emergencyRes, authorizedRes, vaccinesRes, studentRes, docsRes] = await Promise.all([
        fetch(`/api/v1/student-record/${studentId}/emergency-contacts`),
        fetch(`/api/v1/student-record/${studentId}/authorized-pickups`),
        fetch(`/api/v1/student-record/${studentId}/vaccines`),
        fetch(`/api/v1/students/${studentId}`),
        fetch(`/api/v1/documents/${studentId}`),
      ]);
      const emergencyData = await emergencyRes.json();
      const authorizedData = await authorizedRes.json();
      const vaccinesData = await vaccinesRes.json();
      const studentData = await studentRes.json();
      const docsData = await docsRes.json();

      setEmergencyContacts(emergencyData.contacts || []);
      setAuthorizedPickups(authorizedData.authorizedPickups || []);
      setVaccines(vaccinesData.vaccines || []);
      setCards((docsData.documents || []).filter((d: any) => d.doc_type === 'medical_record'));

      const s = studentData.student;
      if (s) {
        setHealth({
          blood_type: s.blood_type || '',
          height_cm: s.height_cm ?? '',
          weight_lbs: s.weight_lbs ?? '',
          primary_doctor: s.primary_doctor || '',
          clinic_name: s.clinic_name || '',
          clinic_phone: s.clinic_phone || '',
          takes_medication: s.takes_medication || '',
          needs_assistance: s.needs_assistance || '',
          allergies: s.allergies || '',
          medical_conditions: s.medical_conditions || '',
          vaccines_updated: s.vaccines_updated || '',
          allowed_medications: s.allowed_medications || [],
          allowed_medications_other: s.allowed_medications_other || '',
        });
      }
    } catch {
      onMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleAddEmergencyContact = async () => {
    if (!emergencyForm.name) { onMessage('❌ Indica el nombre del contacto de emergencia.'); return; }
    try {
      const response = await fetch(`/api/v1/student-record/${studentId}/emergency-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...emergencyForm }),
      });
      const data = await response.json();
      if (data.success) {
        onMessage('✅ Contacto de emergencia agregado.');
        setEmergencyForm(emptyPersonForm);
        loadAll();
      } else {
        onMessage('❌ ' + (data.error || 'No se pudo agregar el contacto.'));
      }
    } catch {
      onMessage('❌ Error de conexión.');
    }
  };

  const handleDeleteEmergencyContact = async (id: string) => {
    await fetch(`/api/v1/student-record/emergency-contacts/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleAddAuthorizedPickup = async () => {
    if (!authorizedForm.name) { onMessage('❌ Indica el nombre de la persona autorizada.'); return; }
    try {
      const response = await fetch(`/api/v1/student-record/${studentId}/authorized-pickups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...authorizedForm }),
      });
      const data = await response.json();
      if (data.success) {
        onMessage('✅ Persona autorizada agregada.');
        setAuthorizedForm(emptyPersonForm);
        loadAll();
      } else {
        onMessage('❌ ' + (data.error || 'No se pudo agregar el autorizado.'));
      }
    } catch {
      onMessage('❌ Error de conexión.');
    }
  };

  const handleDeleteAuthorizedPickup = async (id: string) => {
    await fetch(`/api/v1/student-record/authorized-pickups/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const toggleMedication = (med: string) => {
    setHealth(h => ({
      ...h,
      allowed_medications: h.allowed_medications.includes(med)
        ? h.allowed_medications.filter(m => m !== med)
        : [...h.allowed_medications, med],
    }));
  };

  const handleSaveHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/student-record/${studentId}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...health,
          height_cm: health.height_cm === '' ? null : Number(health.height_cm),
          weight_lbs: health.weight_lbs === '' ? null : Number(health.weight_lbs),
        }),
      });
      const data = await response.json();
      if (data.success) {
        onMessage('✅ Información de salud actualizada.');
      } else {
        onMessage('❌ ' + (data.error || 'No se pudo guardar la información de salud.'));
      }
    } catch {
      onMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleAddVaccine = async () => {
    if (!vaccineForm.date) { onMessage('❌ Indica la fecha de la vacuna.'); return; }
    try {
      const response = await fetch(`/api/v1/student-record/${studentId}/vaccines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...vaccineForm }),
      });
      const data = await response.json();
      if (data.success) {
        onMessage('✅ Vacuna registrada.');
        setVaccineForm({ vaccine_name: VACCINE_OPTIONS[0], dose: DOSE_OPTIONS[0], date: '' });
        loadAll();
      } else {
        onMessage('❌ ' + (data.error || 'No se pudo registrar la vacuna.'));
      }
    } catch {
      onMessage('❌ Error de conexión.');
    }
  };

  const handleDeleteVaccine = async (id: string) => {
    await fetch(`/api/v1/student-record/vaccines/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const handleUploadCard = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      const fakeFileUrl = `documents/${tenantId}/${studentId}/tarjeta_salud_${Date.now()}_${file.name}`;
      const response = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          student_id: studentId,
          uploader_id: requesterId,
          doc_type: 'medical_record',
          title: `Tarjeta de Salud - ${file.name}`,
          file_url: fakeFileUrl,
        }),
      });
      const data = await response.json();
      if (data.success) {
        onMessage('✅ Tarjeta subida al expediente.');
        loadAll();
      } else {
        onMessage('❌ ' + (data.error || 'No se pudo subir la tarjeta.'));
      }
    } catch {
      onMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const PersonTable = ({ rows, onDelete }: { rows: PersonEntry[]; onDelete: (id: string) => void }) => (
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-800 text-white">
        <tr>
          <th className="px-3 py-2 font-semibold">Nombre</th>
          <th className="px-3 py-2 font-semibold">Cédula</th>
          <th className="px-3 py-2 font-semibold">Parentesco</th>
          <th className="px-3 py-2 font-semibold">Teléfono</th>
          <th className="px-3 py-2 font-semibold text-right">Eliminar</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(r => (
          <tr key={r.id} className="hover:bg-slate-50">
            <td className="px-3 py-2 font-medium text-blue-700">{r.name}</td>
            <td className="px-3 py-2">{r.cedula || '—'}</td>
            <td className="px-3 py-2">{r.relationship || '—'}</td>
            <td className="px-3 py-2">{r.phone || '—'}</td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => onDelete(r.id)} className="text-rose-600 hover:text-rose-800">
                <Trash2 className="w-4 h-4 inline" />
              </button>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Sin registros aún.</td></tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center py-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sincronizando expediente médico...
        </div>
      )}

      {/* En Caso de Urgencia */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 bg-blue-600">
          <h2 className="font-bold text-white flex items-center"><ShieldAlert className="w-4 h-4 mr-2" /> En Caso de Urgencia</h2>
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <input placeholder="Nombre" value={emergencyForm.name} onChange={e => setEmergencyForm({ ...emergencyForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Cédula" value={emergencyForm.cedula} onChange={e => setEmergencyForm({ ...emergencyForm, cedula: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
              <input placeholder="Teléfono" value={emergencyForm.phone} onChange={e => setEmergencyForm({ ...emergencyForm, phone: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <input placeholder="Parentesco (ej. Abuelo)" value={emergencyForm.relationship} onChange={e => setEmergencyForm({ ...emergencyForm, relationship: e.target.value })}
                className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm" />
              <button onClick={handleAddEmergencyContact} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold flex items-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <PersonTable rows={emergencyContacts} onDelete={handleDeleteEmergencyContact} />
          </div>
        </div>
      </div>

      {/* Autorizados a retirar estudiante */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 bg-blue-600">
          <h2 className="font-bold text-white flex items-center"><UserCheck2 className="w-4 h-4 mr-2" /> Autorizados a Retirar Estudiante</h2>
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <input placeholder="Nombre" value={authorizedForm.name} onChange={e => setAuthorizedForm({ ...authorizedForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Cédula" value={authorizedForm.cedula} onChange={e => setAuthorizedForm({ ...authorizedForm, cedula: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
              <input placeholder="Teléfono" value={authorizedForm.phone} onChange={e => setAuthorizedForm({ ...authorizedForm, phone: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <input placeholder="Parentesco (ej. Abuelo)" value={authorizedForm.relationship} onChange={e => setAuthorizedForm({ ...authorizedForm, relationship: e.target.value })}
                className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm" />
              <button onClick={handleAddAuthorizedPickup} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold flex items-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <PersonTable rows={authorizedPickups} onDelete={handleDeleteAuthorizedPickup} />
          </div>
        </div>
      </div>

      {/* Salud */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 bg-blue-600">
          <h2 className="font-bold text-white flex items-center"><HeartPulse className="w-4 h-4 mr-2" /> Salud</h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tipo de Sangre</label>
            <input value={health.blood_type} onChange={e => setHealth({ ...health, blood_type: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Médico de Cabecera</label>
            <input value={health.primary_doctor} onChange={e => setHealth({ ...health, primary_doctor: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Estatura (cm)</label>
              <input type="number" value={health.height_cm} onChange={e => setHealth({ ...health, height_cm: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Peso (lbs)</label>
              <input type="number" value={health.weight_lbs} onChange={e => setHealth({ ...health, weight_lbs: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Clínica</label>
              <input value={health.clinic_name} onChange={e => setHealth({ ...health, clinic_name: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Teléfono Clínica</label>
              <input value={health.clinic_phone} onChange={e => setHealth({ ...health, clinic_phone: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">¿El estudiante toma algún medicamento especial?</label>
            <input value={health.takes_medication} onChange={e => setHealth({ ...health, takes_medication: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">¿El estudiante necesita algún tipo de asistencia?</label>
            <input value={health.needs_assistance} onChange={e => setHealth({ ...health, needs_assistance: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">¿Es alérgico a algún medicamento, alimento, picadura o sustancia?</label>
            <input value={health.allergies} onChange={e => setHealth({ ...health, allergies: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">¿Padece alguna enfermedad que el colegio debería conocer?</label>
            <input value={health.medical_conditions} onChange={e => setHealth({ ...health, medical_conditions: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">¿A la fecha cuenta con sus vacunas actualizadas?</label>
            <input value={health.vaccines_updated} onChange={e => setHealth({ ...health, vaccines_updated: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-2">¿Cuál de los siguientes medicamentos la escuela le puede suministrar?</label>
            <div className="flex flex-wrap gap-4">
              {MEDICATION_OPTIONS.map(med => (
                <label key={med} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={health.allowed_medications.includes(med)} onChange={() => toggleMedication(med)} />
                  {med}
                </label>
              ))}
            </div>
            <input placeholder="Otros" value={health.allowed_medications_other} onChange={e => setHealth({ ...health, allowed_medications_other: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-2" />
          </div>
        </div>
        <div className="px-4 pb-4">
          <button onClick={handleSaveHealth} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold disabled:opacity-50">
            Guardar Información de Salud
          </button>
        </div>
      </div>

      {/* Vacunas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 bg-blue-600">
          <h2 className="font-bold text-white flex items-center"><Syringe className="w-4 h-4 mr-2" /> Vacunas</h2>
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <select value={vaccineForm.vaccine_name} onChange={e => setVaccineForm({ ...vaccineForm, vaccine_name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
              {VACCINE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={vaccineForm.dose} onChange={e => setVaccineForm({ ...vaccineForm, dose: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm">
                {DOSE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="date" value={vaccineForm.date} onChange={e => setVaccineForm({ ...vaccineForm, date: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <button onClick={handleAddVaccine} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold flex items-center">
              <Plus className="w-4 h-4 mr-1" /> Agregar Vacuna
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-3 py-2 font-semibold">Vacuna</th>
                  <th className="px-3 py-2 font-semibold">Dosis</th>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold text-right">Eliminar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vaccines.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{v.vaccine_name}</td>
                    <td className="px-3 py-2">{v.dose || '—'}</td>
                    <td className="px-3 py-2">{v.date || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleDeleteVaccine(v.id)} className="text-rose-600 hover:text-rose-800">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {vaccines.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">Sin vacunas registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tarjetas de salud */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold cursor-pointer">
            <Upload className="w-4 h-4 mr-2" /> Subir Tarjeta
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={loading} onChange={e => handleUploadCard(e.target.files?.[0])} />
          </label>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-3 py-2 font-semibold">Documento</th>
              <th className="px-3 py-2 font-semibold">Fecha Subida</th>
              <th className="px-3 py-2 font-semibold text-right">Ver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cards.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{c.title}</td>
                <td className="px-3 py-2">{new Date(c.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <a href={c.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4 inline" /></a>
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">Sin tarjetas subidas aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
