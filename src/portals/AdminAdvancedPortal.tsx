import React, { useEffect, useState } from 'react';
import { Settings2, CalendarRange, BookOpen, CalendarClock, Plus, Loader2, CheckCircle, Users2, Network, DoorOpen, Building2, History, Bell, Send, Radio, DollarSign, X, Layers } from 'lucide-react';

// Contexto de demostración: en producción tenant_id viene del token JWT de Supabase Auth (Fase 2)
const DEMO_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_SENDER_ID = '66666666-6666-6666-6666-666666666666';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type TabId = 'terms' | 'courses' | 'schedules' | 'grades_settings' | 'costs' | 'organization' | 'audit' | 'communications';

interface AuditLog {
  id: string;
  event_type: string;
  description: string;
  actor_name: string | null;
  created_at: string;
}

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  profiles?: { first_name: string; last_name: string } | null;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  department_id: string | null;
  reports_to: string | null;
  departments?: { name: string } | null;
}

interface ExitDoor {
  id: string;
  name: string;
}

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

interface GradeLevel {
  id: string;
  name: string;
  sort_order: number;
  grade_sections: { id: string; name: string }[];
}

interface FeeSchedule {
  id: string;
  grade: string;
  concept: string;
  description: string | null;
  amount: number;
  currency: string;
  recurrence: 'mensual' | 'anual' | 'unico';
  due_day: number | null;
  accounting_code: string | null;
  is_active: boolean;
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

  // --- Grados y Secciones ---
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [gradeLevelsLoading, setGradeLevelsLoading] = useState(false);
  const [gradeLevelForm, setGradeLevelForm] = useState({ name: '', sort_order: '0' });
  const [sectionForms, setSectionForms] = useState<Record<string, string>>({});

  // --- Costos (Tabla de Cargos por Grado) ---
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);
  const [feeScheduleGradeFilter, setFeeScheduleGradeFilter] = useState('');
  const [feeScheduleForm, setFeeScheduleForm] = useState({
    grade: '', concept: '', description: '', amount: '', recurrence: 'unico' as FeeSchedule['recurrence'], due_day: '5', accounting_code: '',
  });
  const [feeSchedulesLoading, setFeeSchedulesLoading] = useState(false);

  // --- Organización (departamentos, jerarquía, puertas de salida) ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [doors, setDoors] = useState<ExitDoor[]>([]);
  const [departmentForm, setDepartmentForm] = useState({ name: '', head_id: '' });
  const [doorForm, setDoorForm] = useState({ name: '' });
  const [assignForm, setAssignForm] = useState<{ staff_id: string; department_id: string; reports_to: string }>({ staff_id: '', department_id: '', reports_to: '' });

  // --- Auditoría y Notificaciones ---
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // --- Comunicaciones y LMS ---
  const [commsLoading, setCommsLoading] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', html_body: '' });
  const [internalForm, setInternalForm] = useState({ target_audience: 'all_staff', subject: '', html_body: '' });
  const [lmsForm, setLmsForm] = useState({ class_id: '', lms_provider: 'Google Classroom', lms_course_id: '' });

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

  const loadOrganization = async () => {
    try {
      const [deptRes, staffRes, doorsRes] = await Promise.all([
        fetch(`/api/v1/hierarchy/departments?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/hierarchy/staff?tenant_id=${DEMO_TENANT_ID}`),
        fetch(`/api/v1/pickup/doors?tenant_id=${DEMO_TENANT_ID}`),
      ]);
      const deptData = await deptRes.json();
      const staffData = await staffRes.json();
      const doorsData = await doorsRes.json();
      setDepartments(deptData.departments || []);
      setStaff(staffData.staff || []);
      setDoors(doorsData.doors || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      const [auditRes, notifRes] = await Promise.all([
        fetch(`/api/v1/system/audit-logs?tenant_id=${DEMO_TENANT_ID}&limit=50`),
        fetch(`/api/v1/system/notifications?tenant_id=${DEMO_TENANT_ID}&limit=50`),
      ]);
      const auditData = await auditRes.json();
      const notifData = await notifRes.json();
      setAuditLogs(auditData.auditLogs || []);
      setNotifications(notifData.notifications || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setAuditLoading(false);
  };

  const handleBroadcast = async () => {
    if (!broadcastForm.subject || !broadcastForm.html_body) {
      setMessage('❌ Completa el asunto y el mensaje del comunicado.');
      return;
    }
    setCommsLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, sender_id: DEMO_SENDER_ID, ...broadcastForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ ' + data.message);
        setBroadcastForm({ subject: '', html_body: '' });
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo enviar el comunicado.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setCommsLoading(false);
  };

  const handleInternalMessage = async () => {
    if (!internalForm.subject || !internalForm.html_body) {
      setMessage('❌ Completa el asunto y el mensaje interno.');
      return;
    }
    setCommsLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/communications/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, sender_id: DEMO_SENDER_ID, sender_role: 'admin', ...internalForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ ' + data.message);
        setInternalForm({ target_audience: 'all_staff', subject: '', html_body: '' });
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo enviar el mensaje interno.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setCommsLoading(false);
  };

  const handleLmsSync = async () => {
    if (!lmsForm.class_id) {
      setMessage('❌ Indica el ID de la clase a sincronizar.');
      return;
    }
    setCommsLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/lms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, ...lmsForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${data.message} (${data.details?.recordsSynced ?? 0} registros sincronizados)`);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo sincronizar con el LMS.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setCommsLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadFeeSchedules = async () => {
    setFeeSchedulesLoading(true);
    try {
      const response = await fetch(`/api/v1/finance/fee-schedules?tenant_id=${DEMO_TENANT_ID}`);
      const data = await response.json();
      setFeeSchedules(data.feeSchedules || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setFeeSchedulesLoading(false);
  };

  const loadGradeLevels = async () => {
    setGradeLevelsLoading(true);
    try {
      const response = await fetch(`/api/v1/grade-settings/levels?tenant_id=${DEMO_TENANT_ID}`);
      const data = await response.json();
      setGradeLevels(data.gradeLevels || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setGradeLevelsLoading(false);
  };

  const handleCreateGradeLevel = async () => {
    if (!gradeLevelForm.name) {
      setMessage('❌ El nombre del grado es requerido.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/grade-settings/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, name: gradeLevelForm.name, sort_order: Number(gradeLevelForm.sort_order) || 0 }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Grado creado.');
        setGradeLevelForm({ name: '', sort_order: '0' });
        loadGradeLevels();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el grado.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleDeleteGradeLevel = async (id: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/grade-settings/levels/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setGradeLevels(prev => prev.filter(g => g.id !== id));
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo eliminar el grado.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleCreateSection = async (gradeLevelId: string) => {
    const name = sectionForms[gradeLevelId];
    if (!name) {
      setMessage('❌ Escribe el nombre de la sección.');
      return;
    }
    setMessage('');
    try {
      const response = await fetch('/api/v1/grade-settings/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, grade_level_id: gradeLevelId, name }),
      });
      const data = await response.json();
      if (data.success) {
        setSectionForms({ ...sectionForms, [gradeLevelId]: '' });
        loadGradeLevels();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear la sección.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleDeleteSection = async (id: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/grade-settings/sections/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        loadGradeLevels();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo eliminar la sección.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  useEffect(() => {
    if (activeTab === 'organization') loadOrganization();
    if (activeTab === 'audit') loadAudit();
    if (activeTab === 'costs') { loadFeeSchedules(); loadGradeLevels(); }
    if (activeTab === 'grades_settings') loadGradeLevels();
  }, [activeTab]);

  const handleCreateFeeSchedule = async () => {
    if (!feeScheduleForm.grade || !feeScheduleForm.concept || !feeScheduleForm.amount) {
      setMessage('❌ Completa grado, concepto y monto del cargo.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/finance/fee-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEMO_TENANT_ID,
          grade: feeScheduleForm.grade,
          concept: feeScheduleForm.concept,
          description: feeScheduleForm.description || null,
          amount: Number(feeScheduleForm.amount),
          currency: 'USD',
          recurrence: feeScheduleForm.recurrence,
          due_day: feeScheduleForm.recurrence === 'mensual' ? Number(feeScheduleForm.due_day) : null,
          accounting_code: feeScheduleForm.accounting_code || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Cargo agregado a la tabla de costos.');
        setFeeScheduleForm({ grade: feeScheduleForm.grade, concept: '', description: '', amount: '', recurrence: 'unico', due_day: '5', accounting_code: '' });
        loadFeeSchedules();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el cargo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleDeleteFeeSchedule = async (id: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/finance/fee-schedules/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setFeeSchedules(prev => prev.filter(fs => fs.id !== id));
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo eliminar el cargo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const handleCreateDepartment = async () => {
    if (!departmentForm.name) {
      setMessage('❌ El nombre del departamento es requerido.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/hierarchy/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, name: departmentForm.name, head_id: departmentForm.head_id || null }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Departamento creado.');
        setDepartmentForm({ name: '', head_id: '' });
        loadOrganization();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el departamento.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleCreateDoor = async () => {
    if (!doorForm.name) {
      setMessage('❌ El nombre de la puerta es requerido.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/pickup/doors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: DEMO_TENANT_ID, name: doorForm.name }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Puerta de salida creada.');
        setDoorForm({ name: '' });
        loadOrganization();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear la puerta.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

  const handleAssignStaff = async () => {
    if (!assignForm.staff_id) {
      setMessage('❌ Selecciona un miembro del staff.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/hierarchy/staff/${assignForm.staff_id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: assignForm.department_id || null,
          reports_to: assignForm.reports_to || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Estructura jerárquica actualizada.');
        setAssignForm({ staff_id: '', department_id: '', reports_to: '' });
        loadOrganization();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo actualizar.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLoading(false);
  };

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
        <button
          onClick={() => setActiveTab('grades_settings')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'grades_settings' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Layers className="w-4 h-4 mr-2" /> Grados y Secciones
        </button>
        <button
          onClick={() => setActiveTab('costs')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'costs' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <DollarSign className="w-4 h-4 mr-2" /> Costos
        </button>
        <button
          onClick={() => setActiveTab('organization')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'organization' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Network className="w-4 h-4 mr-2" /> Organización
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'audit' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <History className="w-4 h-4 mr-2" /> Auditoría
        </button>
        <button
          onClick={() => setActiveTab('communications')}
          className={`px-4 py-2 font-bold rounded-t-lg transition-colors flex items-center ${activeTab === 'communications' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Radio className="w-4 h-4 mr-2" /> Comunicaciones y LMS
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

      {/* Grados y Secciones */}
      {activeTab === 'grades_settings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><Plus className="w-4 h-4 mr-2 text-rose-600" /> Agregar Grado</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text" placeholder="Nombre (ej. 5to Primaria)" value={gradeLevelForm.name}
                onChange={e => setGradeLevelForm({ ...gradeLevelForm, name: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 sm:col-span-2"
              />
              <input
                type="number" placeholder="Orden" value={gradeLevelForm.sort_order}
                onChange={e => setGradeLevelForm({ ...gradeLevelForm, sort_order: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <button
              onClick={handleCreateGradeLevel}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Agregar Grado
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Layers className="w-4 h-4 mr-2 text-rose-600" />
              <h2 className="font-bold text-slate-700">Grados del Colegio</h2>
            </div>
            {gradeLevelsLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando grados...
              </div>
            ) : gradeLevels.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay grados configurados.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {gradeLevels.map(g => (
                  <div key={g.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">{g.name}</span>
                      <button
                        onClick={() => handleDeleteGradeLevel(g.id)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                        title="Eliminar grado"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {g.grade_sections.length === 0 ? (
                        <span className="text-xs text-slate-400">Sin secciones todavía.</span>
                      ) : (
                        g.grade_sections.map(s => (
                          <span key={s.id} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                            {s.name}
                            <button onClick={() => handleDeleteSection(s.id)} className="hover:text-rose-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text" placeholder="Nueva sección (ej. A)" value={sectionForms[g.id] || ''}
                        onChange={e => setSectionForms({ ...sectionForms, [g.id]: e.target.value })}
                        className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <button
                        onClick={() => handleCreateSection(g.id)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm font-semibold hover:bg-slate-200"
                      >
                        Agregar Sección
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Costos: Tabla de Cargos por Grado */}
      {activeTab === 'costs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><Plus className="w-4 h-4 mr-2 text-rose-600" /> Agregar Cargo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={feeScheduleForm.grade}
                onChange={e => setFeeScheduleForm({ ...feeScheduleForm, grade: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Selecciona el grado...</option>
                {gradeLevels.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
              <input
                type="text" placeholder="Concepto (ej. Matrícula)" value={feeScheduleForm.concept}
                onChange={e => setFeeScheduleForm({ ...feeScheduleForm, concept: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="number" placeholder="Costo (USD)" value={feeScheduleForm.amount}
                onChange={e => setFeeScheduleForm({ ...feeScheduleForm, amount: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={feeScheduleForm.recurrence}
                onChange={e => setFeeScheduleForm({ ...feeScheduleForm, recurrence: e.target.value as FeeSchedule['recurrence'] })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="unico">Único (Inscripción)</option>
                <option value="mensual">Mensual (Cuota)</option>
                <option value="anual">Anual (Anualidad)</option>
              </select>
              {feeScheduleForm.recurrence === 'mensual' && (
                <input
                  type="number" placeholder="Día de vencimiento" value={feeScheduleForm.due_day}
                  onChange={e => setFeeScheduleForm({ ...feeScheduleForm, due_day: e.target.value })}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              )}
              <input
                type="text" placeholder="Código contable (opcional)" value={feeScheduleForm.accounting_code}
                onChange={e => setFeeScheduleForm({ ...feeScheduleForm, accounting_code: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <button
              onClick={handleCreateFeeSchedule}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Agregar Cargo
            </button>
          </div>

          {(() => {
            const grades = Array.from(new Set(feeSchedules.map(fs => fs.grade))).sort();
            const visible = feeScheduleGradeFilter ? feeSchedules.filter(fs => fs.grade === feeScheduleGradeFilter) : feeSchedules;
            const totalInscripcion = visible.filter(fs => fs.recurrence === 'unico').reduce((s, fs) => s + Number(fs.amount), 0);
            const totalAnualidad = visible.filter(fs => fs.recurrence === 'anual').reduce((s, fs) => s + Number(fs.amount), 0);
            const totalCuota = visible.filter(fs => fs.recurrence === 'mensual').reduce((s, fs) => s + Number(fs.amount), 0);

            return (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="font-bold text-slate-700">Listado de Costos</h2>
                  {grades.length > 0 && (
                    <select
                      value={feeScheduleGradeFilter}
                      onChange={e => setFeeScheduleGradeFilter(e.target.value)}
                      className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">Todos los grados</option>
                      {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  )}
                </div>

                {feeSchedulesLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando tabla de costos...
                  </div>
                ) : visible.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400">Aún no hay cargos configurados{feeScheduleGradeFilter ? ` para ${feeScheduleGradeFilter}` : ''}.</p>
                ) : (
                  <>
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-10">#</th>
                          <th className="px-4 py-3 font-semibold">DESCRIPCIÓN</th>
                          <th className="px-4 py-3 font-semibold">GRADO</th>
                          <th className="px-4 py-3 font-semibold">COSTO</th>
                          <th className="px-4 py-3 font-semibold text-center">OPCIONES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visible.map((fs, i) => (
                          <tr key={fs.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-700">{fs.concept.toUpperCase()}</p>
                              {fs.description && <p className="text-xs text-slate-400">{fs.description}</p>}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{fs.grade}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{Number(fs.amount).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDeleteFeeSchedule(fs.id)}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                                title="Eliminar cargo"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {feeScheduleGradeFilter && (
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50">
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 font-bold text-blue-700">TOTAL DE INSCRIPCIÓN</td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 font-bold text-blue-700">{totalInscripcion.toFixed(2)}</td>
                            <td className="px-4 py-3" />
                          </tr>
                          <tr className="bg-slate-50">
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 font-bold text-blue-700">ANUALIDAD</td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 font-bold text-blue-700">{totalAnualidad.toFixed(2)}</td>
                            <td className="px-4 py-3" />
                          </tr>
                          <tr className="bg-slate-50">
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 font-bold text-blue-700">CUOTA</td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 font-bold text-blue-700">{totalCuota.toFixed(2)}</td>
                            <td className="px-4 py-3" />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Organización: Departamentos, Jerarquía y Puertas de Salida */}
      {activeTab === 'organization' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="font-bold text-slate-700 flex items-center"><Building2 className="w-4 h-4 mr-2 text-rose-600" /> Crear Departamento</h2>
              <input
                type="text" placeholder="Nombre (ej. Ciencias, Dirección)" value={departmentForm.name}
                onChange={e => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text" placeholder="ID de perfil del jefe de departamento (opcional)" value={departmentForm.head_id}
                onChange={e => setDepartmentForm({ ...departmentForm, head_id: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={handleCreateDepartment}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Crear Departamento
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="font-bold text-slate-700 flex items-center"><DoorOpen className="w-4 h-4 mr-2 text-rose-600" /> Configurar Puerta de Salida</h2>
              <p className="text-sm text-slate-500">Puertas físicas donde el guardia libera a los alumnos hacia los vehículos (SafeSmartPickup).</p>
              <input
                type="text" placeholder="Nombre (ej. Puerta Norte)" value={doorForm.name}
                onChange={e => setDoorForm({ name: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={handleCreateDoor}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Crear Puerta
              </button>
              {doors.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {doors.map(d => (
                    <span key={d.id} className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{d.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold text-slate-700 flex items-center"><Network className="w-4 h-4 mr-2 text-rose-600" /> Asignar Staff a Departamento / Supervisor</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={assignForm.staff_id}
                onChange={e => setAssignForm({ ...assignForm, staff_id: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Selecciona staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>)}
              </select>
              <select
                value={assignForm.department_id}
                onChange={e => setAssignForm({ ...assignForm, department_id: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Sin departamento</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={assignForm.reports_to}
                onChange={e => setAssignForm({ ...assignForm, reports_to: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Sin supervisor directo</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </div>
            <button
              onClick={handleAssignStaff}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users2 className="w-4 h-4 mr-2" />}
              Actualizar Jerarquía
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-700">Organigrama del Staff</h2>
            </div>
            {staff.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay staff registrado.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">NOMBRE</th>
                    <th className="px-4 py-3 font-semibold">ROL</th>
                    <th className="px-4 py-3 font-semibold">DEPARTAMENTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">{s.first_name} {s.last_name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.role}</td>
                      <td className="px-4 py-3 text-slate-500">{s.departments?.name || 'Sin asignar'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Auditoría y Notificaciones */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {auditLoading && (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando bitácora...
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <History className="w-4 h-4 mr-2 text-rose-600" />
              <h2 className="font-bold text-slate-700">Bitácora de Auditoría</h2>
            </div>
            {auditLogs.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay eventos registrados.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{log.event_type}</span>
                      <span className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700">{log.description}</p>
                    {log.actor_name && <p className="text-xs text-slate-400 mt-0.5">Actor: {log.actor_name}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
              <Bell className="w-4 h-4 mr-2 text-rose-600" />
              <h2 className="font-bold text-slate-700">Notificaciones Generadas</h2>
            </div>
            {notifications.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Aún no hay notificaciones generadas.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className="p-4 text-sm flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-700">{n.title}</p>
                      <p className="text-slate-500">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold shrink-0 ${
                      n.type === 'success' ? 'bg-emerald-100 text-emerald-700' :
                      n.type === 'error' ? 'bg-rose-100 text-rose-700' :
                      n.type === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>{n.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comunicaciones y LMS */}
      {activeTab === 'communications' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><Send className="w-4 h-4 mr-2 text-rose-600" /> Comunicado Masivo a Padres</h2>
              <input
                type="text" placeholder="Asunto" value={broadcastForm.subject}
                onChange={e => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <textarea
                placeholder="Mensaje (HTML permitido)" value={broadcastForm.html_body}
                onChange={e => setBroadcastForm({ ...broadcastForm, html_body: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={4}
              />
              <button
                onClick={handleBroadcast}
                disabled={commsLoading}
                className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
              >
                {commsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar a Todos los Padres
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><Users2 className="w-4 h-4 mr-2 text-rose-600" /> Mensaje Interno al Staff</h2>
              <select
                value={internalForm.target_audience}
                onChange={e => setInternalForm({ ...internalForm, target_audience: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="all_staff">Todo el Staff</option>
                <option value="all_teachers">Solo Docentes</option>
                <option value="department_only">Un Departamento</option>
                <option value="direct_reports">Mis Reportes Directos</option>
              </select>
              <input
                type="text" placeholder="Asunto" value={internalForm.subject}
                onChange={e => setInternalForm({ ...internalForm, subject: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <textarea
                placeholder="Mensaje" value={internalForm.html_body}
                onChange={e => setInternalForm({ ...internalForm, html_body: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={4}
              />
              <button
                onClick={handleInternalMessage}
                disabled={commsLoading}
                className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
              >
                {commsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar Mensaje Interno
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
            <h2 className="font-bold text-slate-700 flex items-center"><Radio className="w-4 h-4 mr-2 text-rose-600" /> Sincronización con LMS (Canvas / Google Classroom)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={lmsForm.class_id}
                onChange={e => setLmsForm({ ...lmsForm, class_id: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Selecciona la clase</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={lmsForm.lms_provider}
                onChange={e => setLmsForm({ ...lmsForm, lms_provider: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option>Google Classroom</option>
                <option>Canvas</option>
                <option>Moodle</option>
              </select>
              <input
                type="text" placeholder="ID del curso en el LMS" value={lmsForm.lms_course_id}
                onChange={e => setLmsForm({ ...lmsForm, lms_course_id: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <button
              onClick={handleLmsSync}
              disabled={commsLoading}
              className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
            >
              {commsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
              Sincronizar Calificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
