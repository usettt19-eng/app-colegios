import React, { useEffect, useState } from 'react';
import { Settings2, CalendarRange, BookOpen, CalendarClock, Plus, Loader2, CheckCircle, Users2 } from 'lucide-react';

// Contexto de demostración: en producción tenant_id viene del token JWT de Supabase Auth (Fase 2)
const DEMO_TENANT_ID = 'tenant-demo-123';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type TabId = 'terms' | 'courses' | 'schedules';

interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number | null;
}

interface ClassGroup {
  id: string;
  name: string;
  capacity: number;
  courses?: { name: string; code: string };
  profiles?: { first_name: string; last_name: string } | null;
  academic_terms?: { name: string };
}

export const AdminAdvancedPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('terms');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [terms, setTerms] = useState<Term[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const [termForm, setTermForm] = useState({ name: '', start_date: '', end_date: '', is_active: false });
  const [courseForm, setCourseForm] = useState({ code: '', name: '', credits: '' });
  const [classForm, setClassForm] = useState({ term_id: '', course_id: '', name: '', capacity: '30' });
  const [scheduleForm, setScheduleForm] = useState({ class_id: '', day_of_week: '1', start_time: '08:00', end_time: '09:00', room_number: '' });

  const loadAll = async () => {
    try {
      const [termsRes, coursesRes, classesRes] = await Promise.all([
        fetch(`/api/v1/academics/terms?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/academics/courses?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/academics/classes?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const termsData = await termsRes.json();
      const coursesData = await coursesRes.json();
      const classesData = await classesRes.json();
      setTerms(termsData.terms || []);
      setCourses(coursesData.courses || []);
      setClasses(classesData.classes || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateTerm = async () => {
    if (!termForm.name || !termForm.start_date || !termForm.end_date) {
      setMessage('❌ Completa nombre, fecha de inicio y fin del ciclo.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/academics/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, ...termForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Año lectivo configurado exitosamente.');
        setTermForm({ name: '', start_date: '', end_date: '', is_active: false });
        loadAll();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el año lectivo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleCreateCourse = async () => {
    if (!courseForm.code || !courseForm.name) {
      setMessage('❌ Completa el código y nombre del curso.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/academics/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          code: courseForm.code,
          name: courseForm.name,
          credits: courseForm.credits ? Number(courseForm.credits) : null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Curso agregado al catálogo académico.');
        setCourseForm({ code: '', name: '', credits: '' });
        loadAll();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el curso.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleCreateClass = async () => {
    if (!classForm.term_id || !classForm.course_id || !classForm.name) {
      setMessage('❌ Selecciona ciclo, curso y define un nombre de grupo.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/academics/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          term_id: classForm.term_id,
          course_id: classForm.course_id,
          name: classForm.name,
          capacity: Number(classForm.capacity) || 30,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Grupo creado y asignado al distributivo.');
        setClassForm({ term_id: '', course_id: '', name: '', capacity: '30' });
        loadAll();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el grupo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleCreateSchedule = async () => {
    if (!scheduleForm.class_id) {
      setMessage('❌ Selecciona un grupo/clase para asignarle horario.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/academics/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          class_id: scheduleForm.class_id,
          day_of_week: Number(scheduleForm.day_of_week),
          start_time: scheduleForm.start_time,
          end_time: scheduleForm.end_time,
          room_number: scheduleForm.room_number,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Bloque de horario asignado exitosamente.');
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el bloque de horario.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100 rounded-lg text-rose-700">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Portal Administrativo Avanzado</h1>
            <p className="text-sm text-slate-500">Años lectivos, catálogo de cursos y distributivo de horarios</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-rose-50 text-rose-800 p-4 rounded-lg flex items-center border border-rose-200">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('terms')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'terms' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CalendarRange className="w-4 h-4 mr-2" /> Años Lectivos
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'courses' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <BookOpen className="w-4 h-4 mr-2" /> Cursos y Grupos
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'schedules' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <CalendarClock className="w-4 h-4 mr-2" /> Horarios
        </button>
      </div>

      {/* Años Lectivos */}
      {activeTab === 'terms' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><Plus className="w-4 h-4 mr-2 text-rose-600" /> Configurar Nuevo Año Lectivo</h2>
            <input
              type="text" placeholder="Nombre (ej. Año Lectivo 2027-2028)" value={termForm.name}
              onChange={e => setTermForm({ ...termForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Fecha de inicio</label>
                <input
                  type="date" value={termForm.start_date}
                  onChange={e => setTermForm({ ...termForm, start_date: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Fecha de fin</label>
                <input
                  type="date" value={termForm.end_date}
                  onChange={e => setTermForm({ ...termForm, end_date: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox" checked={termForm.is_active}
                onChange={e => setTermForm({ ...termForm, is_active: e.target.checked })}
              />
              Marcar como ciclo activo
            </label>
            <button
              onClick={handleCreateTerm}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Guardar Año Lectivo
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Ciclos Configurados</h2>
            </div>
            {terms.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay años lectivos configurados.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {terms.map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.start_date} → {t.end_date}</p>
                    </div>
                    {t.is_active && <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Activo</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cursos y Grupos */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="font-bold text-slate-700 flex items-center"><Plus className="w-4 h-4 mr-2 text-rose-600" /> Agregar Curso al Catálogo</h2>
              <input
                type="text" placeholder="Código (ej. MAT-101)" value={courseForm.code}
                onChange={e => setCourseForm({ ...courseForm, code: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text" placeholder="Nombre de la materia" value={courseForm.name}
                onChange={e => setCourseForm({ ...courseForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="number" placeholder="Créditos" value={courseForm.credits}
                onChange={e => setCourseForm({ ...courseForm, credits: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={handleCreateCourse}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Agregar Curso
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="font-bold text-slate-700 flex items-center"><Users2 className="w-4 h-4 mr-2 text-rose-600" /> Crear Grupo / Distributivo</h2>
              <select
                value={classForm.term_id}
                onChange={e => setClassForm({ ...classForm, term_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Selecciona el año lectivo</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select
                value={classForm.course_id}
                onChange={e => setClassForm({ ...classForm, course_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Selecciona el curso</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
              <input
                type="text" placeholder="Nombre del grupo (ej. Grupo A)" value={classForm.name}
                onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="number" placeholder="Capacidad" value={classForm.capacity}
                onChange={e => setClassForm({ ...classForm, capacity: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={handleCreateClass}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Crear Grupo
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Grupos / Distributivo Docente</h2>
            </div>
            {classes.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay grupos creados.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">GRUPO</th>
                    <th className="px-4 py-3 font-semibold">CURSO</th>
                    <th className="px-4 py-3 font-semibold">CICLO</th>
                    <th className="px-4 py-3 font-semibold">DOCENTE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.courses?.code} — {c.courses?.name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.academic_terms?.name}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'Sin asignar'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Horarios */}
      {activeTab === 'schedules' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><CalendarClock className="w-4 h-4 mr-2 text-rose-600" /> Asignar Bloque de Horario</h2>
          <select
            value={scheduleForm.class_id}
            onChange={e => setScheduleForm({ ...scheduleForm, class_id: e.target.value })}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">Selecciona el grupo/clase</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.courses?.name}</option>)}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={scheduleForm.day_of_week}
              onChange={e => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input
              type="time" value={scheduleForm.start_time}
              onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <input
              type="time" value={scheduleForm.end_time}
              onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <input
              type="text" placeholder="Aula (ej. Aula 204)" value={scheduleForm.room_number}
              onChange={e => setScheduleForm({ ...scheduleForm, room_number: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <button
            onClick={handleCreateSchedule}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Asignar Bloque de Horario
          </button>
        </div>
      )}
    </div>
  );
};
