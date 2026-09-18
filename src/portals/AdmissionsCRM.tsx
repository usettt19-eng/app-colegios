import React, { useEffect, useState } from 'react';
import { Plus, Loader2, User, Phone, Mail, ArrowRightCircle, XCircle, GraduationCap } from 'lucide-react';

type Stage = 'interesado' | 'visita_agendada' | 'examen_admision' | 'matriculado' | 'perdido';

interface Prospect {
  id: string;
  student_first_name: string;
  student_last_name: string;
  desired_grade_level_id: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  source: string | null;
  stage: Stage;
  stage_updated_at: string;
  visit_date: string | null;
  exam_date: string | null;
  exam_score: number | null;
  notes: string | null;
  assigned_to: string | null;
  lost_reason: string | null;
  converted_student_id: string | null;
  grade_levels?: { name: string } | null;
  profiles?: { first_name: string; last_name: string } | null;
}

interface GradeLevel {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  tenantId: string;
  onConvert: (prospect: Prospect) => void;
}

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: 'interesado', label: 'Interesado', color: 'border-slate-300' },
  { id: 'visita_agendada', label: 'Visita Agendada', color: 'border-sky-300' },
  { id: 'examen_admision', label: 'Examen de Admisión', color: 'border-amber-300' },
  { id: 'matriculado', label: 'Matriculado', color: 'border-emerald-300' },
  { id: 'perdido', label: 'Perdido', color: 'border-rose-300' },
];

const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  interesado: 'visita_agendada',
  visita_agendada: 'examen_admision',
  examen_admision: 'matriculado',
};

const daysSince = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
};

const emptyForm = { student_first_name: '', student_last_name: '', desired_grade_level_id: '', parent_name: '', parent_email: '', parent_phone: '', source: '' };

export const AdmissionsCRM: React.FC<Props> = ({ tenantId, onConvert }) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<Prospect>>>({});
  const [lostReasonDrafts, setLostReasonDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadProspects = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/admissions-crm/prospects?tenant_id=${tenantId}`);
      const data = await response.json();
      setProspects(data.prospects || []);
    } catch {
      setMessage('❌ No se pudo cargar el pipeline de admisiones.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProspects();
    fetch(`/api/v1/grade-settings/levels?tenant_id=${tenantId}`)
      .then(r => r.json())
      .then(d => setGradeLevels(d.gradeLevels || []))
      .catch(() => {});
    fetch(`/api/v1/hierarchy/staff?tenant_id=${tenantId}`)
      .then(r => r.json())
      .then(d => setStaffOptions(d.staff || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const gradeLevelName = (id: string | null) => gradeLevels.find(g => g.id === id)?.name || null;

  const handleCreateProspect = async () => {
    if (!newForm.student_first_name || !newForm.student_last_name) {
      setMessage('❌ Nombre y apellido del alumno son requeridos.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/admissions-crm/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...newForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${newForm.student_first_name} ${newForm.student_last_name} agregado(a) al pipeline.`);
        setNewForm(emptyForm);
        setShowNewForm(false);
        loadProspects();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo registrar el prospecto.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setCreating(false);
  };

  const handleMoveStage = async (prospect: Prospect, stage: Stage, lostReason?: string) => {
    setSavingId(prospect.id);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/admissions-crm/prospects/${prospect.id}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, lost_reason: lostReason }),
      });
      const data = await response.json();
      if (data.success) {
        loadProspects();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo mover el prospecto.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setSavingId(null);
  };

  const handleSaveDetails = async (prospect: Prospect) => {
    const draft = editDrafts[prospect.id];
    if (!draft) return;
    setSavingId(prospect.id);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/admissions-crm/prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Prospecto actualizado.');
        loadProspects();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo actualizar.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setSavingId(null);
  };

  const updateDraft = (id: string, patch: Partial<Prospect>) => {
    setEditDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const byStage = (stage: Stage) => prospects.filter(p => p.stage === stage);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-700">Pipeline de Prospectos</h2>
          <p className="text-xs text-slate-500">Sigue a cada familia desde el primer contacto hasta la matrícula.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center px-3 py-1.5 rounded-md text-sm font-bold bg-teal-100 text-teal-700 hover:bg-teal-200"
        >
          <Plus className="w-4 h-4 mr-1" /> Nuevo Prospecto
        </button>
      </div>

      {message && (
        <div className="bg-teal-50 text-teal-800 p-3 rounded-lg border border-teal-200 text-sm break-all">{message}</div>
      )}

      {showNewForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text" placeholder="Nombre del alumno" value={newForm.student_first_name}
              onChange={e => setNewForm({ ...newForm, student_first_name: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text" placeholder="Apellido del alumno" value={newForm.student_last_name}
              onChange={e => setNewForm({ ...newForm, student_last_name: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <select
              value={newForm.desired_grade_level_id}
              onChange={e => setNewForm({ ...newForm, desired_grade_level_id: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Grado deseado (opcional)</option>
              {gradeLevels.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input
              type="text" placeholder="¿Cómo nos conoció? (opcional)" value={newForm.source}
              onChange={e => setNewForm({ ...newForm, source: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text" placeholder="Nombre del padre/madre/acudiente" value={newForm.parent_name}
              onChange={e => setNewForm({ ...newForm, parent_name: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="email" placeholder="Email de contacto" value={newForm.parent_email}
              onChange={e => setNewForm({ ...newForm, parent_email: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="text" placeholder="Teléfono de contacto" value={newForm.parent_phone}
              onChange={e => setNewForm({ ...newForm, parent_phone: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleCreateProspect}
            disabled={creating}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 font-semibold text-sm"
          >
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Agregar al Pipeline
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando pipeline...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {STAGES.map(stageInfo => {
            const items = byStage(stageInfo.id);
            return (
              <div key={stageInfo.id} className={`bg-slate-50 rounded-xl border-t-4 ${stageInfo.color} border-x border-b border-slate-200 overflow-hidden`}>
                <div className="p-3 bg-white border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-600">{stageInfo.label}</span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                  {items.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Sin prospectos</p>}
                  {items.map(p => {
                    const isExpanded = expandedId === p.id;
                    const draft = editDrafts[p.id] || {};
                    return (
                      <div key={p.id} className="bg-white rounded-lg border border-slate-200 shadow-sm">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          className="w-full text-left p-3"
                        >
                          <p className="font-semibold text-sm text-slate-700">{p.student_first_name} {p.student_last_name}</p>
                          <p className="text-xs text-slate-400">{gradeLevelName(p.desired_grade_level_id) || 'Sin grado'} · {daysSince(p.stage_updated_at)}d en esta etapa</p>
                          {p.profiles && <p className="text-xs text-slate-400 mt-0.5">Asignado: {p.profiles.first_name} {p.profiles.last_name}</p>}
                        </button>

                        {isExpanded && (
                          <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50">
                            {(p.parent_name || p.parent_email || p.parent_phone) && (
                              <div className="text-xs text-slate-600 space-y-0.5">
                                {p.parent_name && <p className="flex items-center"><User className="w-3 h-3 mr-1.5" /> {p.parent_name}</p>}
                                {p.parent_email && <p className="flex items-center"><Mail className="w-3 h-3 mr-1.5" /> {p.parent_email}</p>}
                                {p.parent_phone && <p className="flex items-center"><Phone className="w-3 h-3 mr-1.5" /> {p.parent_phone}</p>}
                              </div>
                            )}

                            {p.stage === 'visita_agendada' && (
                              <label className="block text-xs text-slate-500">
                                Fecha de visita
                                <input
                                  type="date" defaultValue={p.visit_date || ''}
                                  onChange={e => updateDraft(p.id, { visit_date: e.target.value })}
                                  className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs mt-0.5"
                                />
                              </label>
                            )}
                            {p.stage === 'examen_admision' && (
                              <div className="grid grid-cols-2 gap-2">
                                <label className="block text-xs text-slate-500">
                                  Fecha de examen
                                  <input
                                    type="date" defaultValue={p.exam_date || ''}
                                    onChange={e => updateDraft(p.id, { exam_date: e.target.value })}
                                    className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs mt-0.5"
                                  />
                                </label>
                                <label className="block text-xs text-slate-500">
                                  Resultado
                                  <input
                                    type="number" defaultValue={p.exam_score ?? ''}
                                    onChange={e => updateDraft(p.id, { exam_score: e.target.value as any })}
                                    className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs mt-0.5"
                                  />
                                </label>
                              </div>
                            )}

                            <label className="block text-xs text-slate-500">
                              Asignado a
                              <select
                                defaultValue={p.assigned_to || ''}
                                onChange={e => updateDraft(p.id, { assigned_to: e.target.value })}
                                className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs mt-0.5"
                              >
                                <option value="">Sin asignar</option>
                                {staffOptions.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                              </select>
                            </label>

                            <label className="block text-xs text-slate-500">
                              Notas
                              <textarea
                                defaultValue={p.notes || ''}
                                onChange={e => updateDraft(p.id, { notes: e.target.value })}
                                rows={2}
                                className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs mt-0.5"
                              />
                            </label>

                            <button
                              onClick={() => handleSaveDetails(p)}
                              disabled={savingId === p.id || Object.keys(draft).length === 0}
                              className="text-xs font-bold text-teal-600 hover:text-teal-800 disabled:opacity-40"
                            >
                              Guardar cambios
                            </button>

                            {p.lost_reason && (
                              <p className="text-xs text-rose-600 italic">Motivo de pérdida: {p.lost_reason}</p>
                            )}

                            {p.converted_student_id && (
                              <p className="text-xs text-emerald-600 font-semibold flex items-center"><GraduationCap className="w-3.5 h-3.5 mr-1" /> Convertido a expediente de alumno</p>
                            )}

                            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200">
                              {NEXT_STAGE[p.stage] && (
                                <button
                                  onClick={() => handleMoveStage(p, NEXT_STAGE[p.stage]!)}
                                  disabled={savingId === p.id}
                                  className="flex items-center text-xs font-bold text-emerald-600 hover:text-emerald-800 disabled:opacity-40"
                                >
                                  <ArrowRightCircle className="w-3.5 h-3.5 mr-1" /> Avanzar a "{STAGES.find(s => s.id === NEXT_STAGE[p.stage])?.label}"
                                </button>
                              )}
                              {p.stage !== 'matriculado' && !p.converted_student_id && (
                                <button
                                  onClick={() => onConvert(p)}
                                  className="flex items-center text-xs font-bold text-teal-600 hover:text-teal-800"
                                >
                                  <GraduationCap className="w-3.5 h-3.5 mr-1" /> Convertir a Matrícula
                                </button>
                              )}
                              {p.stage !== 'perdido' && p.stage !== 'matriculado' && (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text" placeholder="Motivo si se pierde"
                                    value={lostReasonDrafts[p.id] || ''}
                                    onChange={e => setLostReasonDrafts({ ...lostReasonDrafts, [p.id]: e.target.value })}
                                    className="border border-slate-300 rounded-md px-2 py-1 text-xs w-28"
                                  />
                                  <button
                                    onClick={() => handleMoveStage(p, 'perdido', lostReasonDrafts[p.id] || '')}
                                    disabled={savingId === p.id || !lostReasonDrafts[p.id]}
                                    className="flex items-center text-xs font-bold text-rose-600 hover:text-rose-800 disabled:opacity-40"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
