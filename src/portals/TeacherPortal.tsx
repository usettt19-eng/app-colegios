import React, { useEffect, useState } from 'react';
import { Calendar, CheckSquare, AlertTriangle, Send, BookOpen, Plus, Loader2, ClipboardCheck, GraduationCap, MessageSquare, Award } from 'lucide-react';
import { MessagingInbox } from './MessagingInbox';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from './LoginPage';

type TabId = 'attendance' | 'assignments' | 'grades' | 'messages';

interface ClassGroup {
  id: string;
  name: string;
  term_id?: string;
  courses?: { name: string; code: string };
}

interface RosterStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  status?: string;
}

interface GradeRosterStudent {
  class_enrollment_id: string;
  enrollment_id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  final_grade: number | null;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  max_score: number;
}

interface Submission {
  id: string;
  student_id: string;
  status: string;
  score: number | null;
  students?: { first_name: string; last_name: string };
}

interface InnerProps {
  tenantId: string;
  teacherId: string;
  teacherName: string;
  onSignOut: () => void;
}

const TeacherPortalInner: React.FC<InnerProps> = ({ tenantId, teacherId, teacherName, onSignOut }) => {
  const DEMO_TENANT_ID = tenantId;
  const DEMO_TEACHER_ID = teacherId;
  const [activeTab, setActiveTab] = useState<TabId>('attendance');
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // --- Tareas y Calificaciones ---
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', due_date: '', max_score: '100', type: 'tarea' });
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});

  // --- Notas Finales y Boletines ---
  const [gradesRoster, setGradesRoster] = useState<GradeRosterStudent[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, string>>({});
  const [bulletinLoadingId, setBulletinLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const response = await fetch(`/api/v1/academics/classes?tenant_id=${DEMO_TENANT_ID}&teacher_id=${DEMO_TEACHER_ID}`);
        const data = await response.json();
        const loadedClasses = data.classes || [];
        setClasses(loadedClasses);
        if (loadedClasses.length > 0) setSelectedClassId(loadedClasses[0].id);
      } catch {
        setMessage('❌ No se pudo conectar con el servidor SIS.');
      }
    };
    loadClasses();
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    loadRoster();
    if (activeTab === 'assignments') loadAssignments();
    if (activeTab === 'grades') loadGradesRoster();
  }, [selectedClassId, activeTab]);

  const loadGradesRoster = async () => {
    setGradesLoading(true);
    try {
      const response = await fetch(`/api/v1/academics/classes/${selectedClassId}/roster`);
      const data = await response.json();
      setGradesRoster(data.roster || []);
    } catch {
      setMessage('❌ No se pudo cargar la lista de notas finales.');
    }
    setGradesLoading(false);
  };

  const handleSaveFinalGrade = async (classEnrollmentId: string) => {
    const grade = gradeDrafts[classEnrollmentId];
    if (!grade) {
      setMessage('❌ Indica una nota antes de guardar.');
      return;
    }
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/academics/class-enrollments/${classEnrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_grade: grade }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Nota final guardada.');
        loadGradesRoster();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo guardar la nota.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setIsSubmitting(false);
  };

  const handleGenerateBulletin = async (student: GradeRosterStudent) => {
    if (!currentClass?.term_id) {
      setMessage('❌ No se pudo determinar el ciclo académico de esta clase.');
      return;
    }
    setBulletinLoadingId(student.class_enrollment_id);
    setMessage('');
    try {
      const genResponse = await fetch('/api/v1/bulletins/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          term_id: currentClass.term_id,
          student_id: student.student_id,
          enrollment_id: student.enrollment_id,
        }),
      });
      const genData = await genResponse.json();
      if (!genData.success) {
        setMessage('❌ ' + (genData.error || 'No se pudo generar el boletín.'));
        setBulletinLoadingId(null);
        return;
      }

      const pubResponse = await fetch('/api/v1/bulletins/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_card_id: genData.reportCard.id }),
      });
      const pubData = await pubResponse.json();
      if (pubData.success) {
        setMessage(`✅ Boletín de ${student.first_name} ${student.last_name} generado y publicado. El padre ya fue notificado.`);
      } else {
        setMessage('❌ ' + (pubData.error || 'El boletín se generó pero no se pudo publicar.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setBulletinLoadingId(null);
  };

  const loadRoster = async () => {
    try {
      const response = await fetch(`/api/v1/academics/classes/${selectedClassId}/roster`);
      const data = await response.json();
      setRoster((data.roster || []).map((r: RosterStudent) => ({ ...r, status: 'present' })));
    } catch {
      setMessage('❌ No se pudo cargar el roster de la clase.');
    }
  };

  const toggleStatus = (studentId: string, newStatus: string) => {
    setRoster(roster.map(s => s.student_id === studentId ? { ...s, status: newStatus } : s));
  };

  const submitAttendance = async () => {
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/attendance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          class_id: selectedClassId,
          teacher_id: DEMO_TEACHER_ID,
          records: roster.map(s => ({ student_id: s.student_id, status: s.status }))
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage('✅ Asistencia guardada correctamente. Alertas revisadas.');
      } else {
        setMessage('❌ Error al guardar asistencia: ' + data.error);
      }
    } catch (error) {
      setMessage('❌ Error de conexión.');
    }
    setIsSubmitting(false);
  };

  const loadAssignments = async () => {
    try {
      const response = await fetch(`/api/v1/assignments?class_id=${selectedClassId}`);
      const data = await response.json();
      setAssignments(data.assignments || []);
    } catch {
      setMessage('❌ No se pudieron cargar las tareas.');
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.title || !assignmentForm.due_date) {
      setMessage('❌ Indica el título y la fecha límite de la tarea.');
      return;
    }
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          class_id: selectedClassId,
          teacher_id: DEMO_TEACHER_ID,
          title: assignmentForm.title,
          description: assignmentForm.description,
          due_date: assignmentForm.due_date,
          max_score: Number(assignmentForm.max_score) || 100,
          type: assignmentForm.type,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Tarea creada y asignada a los alumnos.');
        setAssignmentForm({ title: '', description: '', due_date: '', max_score: '100', type: 'tarea' });
        loadAssignments();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear la tarea.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setIsSubmitting(false);
  };

  const handleViewSubmissions = async (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    try {
      const response = await fetch(`/api/v1/assignments/${assignmentId}/submissions`);
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch {
      setMessage('❌ No se pudieron cargar las entregas.');
    }
  };

  const handleGrade = async (studentAssignmentId: string) => {
    const score = scoreDrafts[studentAssignmentId];
    if (!score) {
      setMessage('❌ Indica una calificación antes de guardar.');
      return;
    }
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/assignments/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_assignment_id: studentAssignmentId,
          score: Number(score),
          teacher_id: DEMO_TEACHER_ID,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Calificación guardada.');
        handleViewSubmissions(selectedAssignmentId);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo calificar.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setIsSubmitting(false);
  };

  const currentClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Portal del Docente</h1>
          <p className="text-gray-500">{currentClass ? `${currentClass.courses?.name || 'Materia'} - ${currentClass.name}` : 'Selecciona una clase'}</p>
        </div>
        <div className="flex items-center gap-3">
          {classes.length > 0 && (
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.courses?.name} - {c.name}</option>)}
            </select>
          )}
          <span className="flex items-center text-sm text-gray-600"><Calendar className="w-4 h-4 mr-1" /> {new Date().toLocaleDateString()}</span>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-700">{teacherName}</p>
          </div>
          <button
            onClick={onSignOut}
            className="px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-md border border-gray-200"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No hay grupos asignados a este docente todavía. Créalos desde el Portal Administrativo (Cursos y Grupos).
        </div>
      )}

      {classes.length > 0 && (
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center text-sm ${activeTab === 'attendance' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <CheckSquare className="w-4 h-4 mr-2" /> Asistencia
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center text-sm ${activeTab === 'assignments' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <BookOpen className="w-4 h-4 mr-2" /> Tareas y Calificaciones
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center text-sm ${activeTab === 'grades' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <GraduationCap className="w-4 h-4 mr-2" /> Notas Finales
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center text-sm ${activeTab === 'messages' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Mensajería
          </button>
        </div>
      )}

      {message && (
        <div className="text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2">{message}</div>
      )}

      {activeTab === 'attendance' && classes.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center">
              <CheckSquare className="w-5 h-5 text-indigo-600 mr-2" />
              <h2 className="font-semibold text-indigo-900">Pase de Lista Diario</h2>
            </div>

            {roster.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No hay alumnos matriculados en este grupo.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {roster.map((student) => (
                  <div key={student.student_id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden">
                        {student.photo_url ? (
                          <img src={student.photo_url} alt={student.first_name} className="w-full h-full object-cover" />
                        ) : (
                          student.first_name?.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{student.first_name} {student.last_name}</p>
                        <p className="text-xs text-gray-500">ID: {student.student_id}</p>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleStatus(student.student_id, 'present')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${student.status === 'present' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        Presente
                      </button>
                      <button
                        onClick={() => toggleStatus(student.student_id, 'late')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${student.status === 'late' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        Atraso
                      </button>
                      <button
                        onClick={() => toggleStatus(student.student_id, 'absent')}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${student.status === 'absent' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        Ausente
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end items-center">
              <button
                onClick={submitAttendance}
                disabled={isSubmitting || roster.length === 0}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Guardando...' : 'Guardar Asistencia'}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 flex items-start border border-yellow-200">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold">Nota del Sistema (Motor de Prevención de Deserción)</p>
              <p className="mt-1">Si marcas a un alumno como Ausente y este acumula 3 faltas consecutivas, el backend automáticamente creará una <strong>Alerta Temprana</strong> y enviará un <strong>SMS al Representante</strong> vía Twilio.</p>
            </div>
          </div>
        </>
      )}

      {activeTab === 'assignments' && classes.length > 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 space-y-3">
            <h2 className="font-semibold text-gray-800 flex items-center"><Plus className="w-4 h-4 mr-2 text-indigo-600" /> Nueva Tarea</h2>
            <input
              type="text" placeholder="Título" value={assignmentForm.title}
              onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              placeholder="Descripción (opcional)" value={assignmentForm.description}
              onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                value={assignmentForm.type}
                onChange={e => setAssignmentForm({ ...assignmentForm, type: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="tarea">Tarea</option>
                <option value="examen">Examen</option>
                <option value="actividad">Actividad</option>
                <option value="proyecto">Proyecto</option>
              </select>
              <input
                type="date" value={assignmentForm.due_date}
                onChange={e => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="number" placeholder="Puntaje máximo" value={assignmentForm.max_score}
                onChange={e => setAssignmentForm({ ...assignmentForm, max_score: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-gray-400">El tipo determina cómo se ve en el calendario "Notas y Agendas" del padre (Tarea/Examen/Actividad/Proyecto).</p>
            <button
              onClick={handleCreateAssignment}
              disabled={isSubmitting}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear Tarea
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Tareas de este Grupo</h2>
            </div>
            {assignments.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Aún no hay tareas creadas para esta clase.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {assignments.map(a => (
                  <div key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{a.title}</p>
                      <p className="text-xs text-gray-500">Vence: {a.due_date} · Máx: {a.max_score} pts</p>
                    </div>
                    <button
                      onClick={() => handleViewSubmissions(a.id)}
                      className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded text-sm"
                    >
                      <ClipboardCheck className="w-4 h-4 mr-1.5" /> Calificar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedAssignmentId && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Entregas y Calificaciones</h2>
              </div>
              {submissions.length === 0 ? (
                <p className="p-6 text-sm text-gray-400">No hay entregas registradas para esta tarea.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {submissions.map(s => (
                    <div key={s.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{s.students?.first_name} {s.students?.last_name}</p>
                        <p className="text-xs text-gray-500">
                          Estado: {s.status} {s.score !== null && `· Nota actual: ${s.score}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" placeholder="Nota" defaultValue={s.score ?? ''}
                          onChange={e => setScoreDrafts({ ...scoreDrafts, [s.id]: e.target.value })}
                          className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => handleGrade(s.id)}
                          disabled={isSubmitting}
                          className="text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-sm disabled:opacity-50"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'grades' && classes.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center">
            <GraduationCap className="w-5 h-5 text-indigo-600 mr-2" />
            <h2 className="font-semibold text-gray-800">Notas Finales de {currentClass?.courses?.name || 'la materia'}</h2>
          </div>
          {gradesLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando notas...
            </div>
          ) : gradesRoster.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No hay alumnos matriculados en este grupo.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {gradesRoster.map(student => (
                <div key={student.class_enrollment_id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800">{student.first_name} {student.last_name}</p>
                    <p className="text-xs text-gray-500">Nota actual: {student.final_grade ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="0.01" placeholder="Nota" defaultValue={student.final_grade ?? ''}
                      onChange={e => setGradeDrafts({ ...gradeDrafts, [student.class_enrollment_id]: e.target.value })}
                      className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => handleSaveFinalGrade(student.class_enrollment_id)}
                      disabled={isSubmitting}
                      className="text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-sm disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => handleGenerateBulletin(student)}
                      disabled={bulletinLoadingId === student.class_enrollment_id || student.final_grade === null}
                      title={student.final_grade === null ? 'Guarda una nota final primero' : 'Genera y publica el boletín del alumno'}
                      className="flex items-center text-emerald-600 font-bold hover:text-emerald-800 bg-emerald-50 px-3 py-1 rounded text-sm disabled:opacity-50"
                    >
                      {bulletinLoadingId === student.class_enrollment_id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Award className="w-4 h-4 mr-1" />}
                      Boletín
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <MessagingInbox tenantId={DEMO_TENANT_ID} profileId={DEMO_TEACHER_ID} recipientRole="parent" />
      )}
    </div>
  );
};

export const TeacherPortal: React.FC = () => {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Verificando sesión...
      </div>
    );
  }

  if (!session || !profile) return <LoginPage />;

  if (profile.role !== 'teacher') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-sm text-amber-800">
          Esta cuenta ({profile.email}) no tiene el rol de docente, así que no puede ver el Portal del Docente.
        </div>
        <button onClick={signOut} className="mt-4 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-md border border-slate-200">
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <TeacherPortalInner
      tenantId={profile.tenant_id}
      teacherId={profile.id}
      teacherName={`${profile.first_name} ${profile.last_name}`}
      onSignOut={signOut}
    />
  );
};
