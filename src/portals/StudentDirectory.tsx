import React, { useEffect, useState } from 'react';
import { Search, Users2, UserPlus, Link2, X, ChevronDown, ChevronUp, Loader2, CheckCircle, Plus } from 'lucide-react';

interface Guardian {
  relationship: string;
  profiles: { id: string; first_name: string; last_name: string; email: string; role: string } | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  section: string | null;
  photo_url: string | null;
  parent_students: Guardian[];
}

interface ParentSuggestion {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface GradeLevel {
  id: string;
  name: string;
  sort_order: number;
  grade_sections?: { id: string; name: string }[];
}

interface Props {
  tenantId: string;
}

const RELATIONSHIPS = [
  { value: 'madre', label: 'Madre' },
  { value: 'padre', label: 'Padre' },
  { value: 'acudiente', label: 'Acudiente' },
];

export const StudentDirectory: React.FC<Props> = ({ tenantId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [parentSearch, setParentSearch] = useState('');
  const [parentSuggestions, setParentSuggestions] = useState<ParentSuggestion[]>([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('madre');
  const [linking, setLinking] = useState(false);

  const [creatingParent, setCreatingParent] = useState(false);
  const [newParentForm, setNewParentForm] = useState({ first_name: '', last_name: '', email: '', password: '' });

  // --- Agregar Alumno (solo lo esencial; el resto lo completa el padre
  // después desde "Actualización de Datos" en su portal) ---
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ first_name: '', last_name: '' });
  const [newStudentGradeLevelId, setNewStudentGradeLevelId] = useState('');
  const [newStudentSectionId, setNewStudentSectionId] = useState('');
  const [addParentSearch, setAddParentSearch] = useState('');
  const [addParentSuggestions, setAddParentSuggestions] = useState<ParentSuggestion[]>([]);
  const [addSelectedParent, setAddSelectedParent] = useState<ParentSuggestion | null>(null);
  const [addParentRelationship, setAddParentRelationship] = useState('madre');
  const [addCreatingParent, setAddCreatingParent] = useState(false);
  const [addNewParentForm, setAddNewParentForm] = useState({ first_name: '', last_name: '', email: '', password: '' });

  const newStudentSections = gradeLevels.find(g => g.id === newStudentGradeLevelId)?.grade_sections || [];

  useEffect(() => {
    if (!addParentSearch || addSelectedParent) {
      setAddParentSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/v1/profiles?tenant_id=${tenantId}&role=parent&search=${encodeURIComponent(addParentSearch)}`)
        .then(r => r.json())
        .then(d => setAddParentSuggestions(d.profiles || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [addParentSearch, addSelectedParent, tenantId]);

  const resetAddStudentForm = () => {
    setNewStudentForm({ first_name: '', last_name: '' });
    setNewStudentGradeLevelId('');
    setNewStudentSectionId('');
    setAddParentSearch('');
    setAddParentSuggestions([]);
    setAddSelectedParent(null);
    setAddParentRelationship('madre');
    setAddCreatingParent(false);
    setAddNewParentForm({ first_name: '', last_name: '', email: '', password: '' });
  };

  const handleAddStudent = async () => {
    if (!newStudentForm.first_name || !newStudentForm.last_name) {
      setMessage('❌ Nombre y apellido son requeridos.');
      return;
    }
    setAddingStudent(true);
    setMessage('');
    try {
      let parentId = addSelectedParent?.id;

      if (!parentId && addCreatingParent) {
        if (!addNewParentForm.first_name || !addNewParentForm.last_name || !addNewParentForm.email || !addNewParentForm.password) {
          setMessage('❌ Completa todos los campos del padre nuevo.');
          setAddingStudent(false);
          return;
        }
        const createRes = await fetch('/api/v1/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenantId, role: 'parent', ...addNewParentForm }),
        });
        const createData = await createRes.json();
        if (!createData.success) {
          setMessage('❌ ' + (createData.error || 'No se pudo crear el padre.'));
          setAddingStudent(false);
          return;
        }
        parentId = createData.profile.id;
      }

      const response = await fetch('/api/v1/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          first_name: newStudentForm.first_name,
          last_name: newStudentForm.last_name,
          grade_section_id: newStudentSectionId || null,
          parent_id: parentId || null,
          relationship: addParentRelationship,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${newStudentForm.first_name} ${newStudentForm.last_name} agregado(a). El resto de sus datos (salud, contactos, etc.) los completa el padre desde su portal.`);
        resetAddStudentForm();
        setShowAddStudent(false);
        loadStudents();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el alumno.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setAddingStudent(false);
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/students?tenant_id=${tenantId}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      const data = await response.json();
      setStudents(data.students || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setLoading(false);
  };

  useEffect(() => {
    const timeout = setTimeout(loadStudents, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetch(`/api/v1/grade-settings/levels?tenant_id=${tenantId}`)
      .then(r => r.json())
      .then(d => setGradeLevels(d.gradeLevels || []))
      .catch(() => {});
  }, [tenantId]);

  const gradeSortOrder = (gradeName: string | null) => {
    if (!gradeName) return 9999;
    const level = gradeLevels.find(g => g.name.trim().toLowerCase() === gradeName.trim().toLowerCase());
    return level ? level.sort_order : 9998;
  };

  const groups = React.useMemo(() => {
    const map = new Map<string, { grade: string; section: string; students: Student[] }>();
    for (const student of students) {
      const grade = student.grade || 'Sin grado';
      const section = student.section || 'Sin sección';
      const key = `${grade}||${section}`;
      if (!map.has(key)) map.set(key, { grade, section, students: [] });
      map.get(key)!.students.push(student);
    }
    return Array.from(map.values()).sort((a, b) => {
      const orderDiff = gradeSortOrder(a.grade) - gradeSortOrder(b.grade);
      if (orderDiff !== 0) return orderDiff;
      return a.section.localeCompare(b.section);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, gradeLevels]);

  const toggleGroup = (key: string) => setCollapsedGroups({ ...collapsedGroups, [key]: !collapsedGroups[key] });

  useEffect(() => {
    if (!parentSearch) {
      setParentSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/v1/profiles?tenant_id=${tenantId}&role=parent&search=${encodeURIComponent(parentSearch)}`)
        .then(r => r.json())
        .then(d => setParentSuggestions(d.profiles || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [parentSearch, tenantId]);

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setParentSearch('');
    setParentSuggestions([]);
    setSelectedParentId('');
    setCreatingParent(false);
    setNewParentForm({ first_name: '', last_name: '', email: '', password: '' });
  };

  const handleLinkExisting = async (studentId: string) => {
    if (!selectedParentId) {
      setMessage('❌ Selecciona un padre de la lista.');
      return;
    }
    setLinking(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/students/${studentId}/guardians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: selectedParentId, relationship: linkRelationship }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Padre vinculado al alumno.');
        setParentSearch('');
        setParentSuggestions([]);
        setSelectedParentId('');
        loadStudents();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo vincular al padre.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLinking(false);
  };

  const handleCreateAndLink = async (studentId: string) => {
    if (!newParentForm.first_name || !newParentForm.last_name || !newParentForm.email || !newParentForm.password) {
      setMessage('❌ Completa todos los campos del padre nuevo.');
      return;
    }
    setLinking(true);
    setMessage('');
    try {
      const createRes = await fetch('/api/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, role: 'parent', ...newParentForm }),
      });
      const createData = await createRes.json();
      if (!createData.success) {
        setMessage('❌ ' + (createData.error || 'No se pudo crear el padre.'));
        setLinking(false);
        return;
      }

      const linkRes = await fetch(`/api/v1/students/${studentId}/guardians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: createData.profile.id, relationship: linkRelationship }),
      });
      const linkData = await linkRes.json();
      if (linkData.success) {
        setMessage(`✅ ${newParentForm.first_name} ${newParentForm.last_name} creado(a) y vinculado(a) al alumno.`);
        setCreatingParent(false);
        setNewParentForm({ first_name: '', last_name: '', email: '', password: '' });
        loadStudents();
      } else {
        setMessage('❌ El padre se creó, pero no se pudo vincular: ' + (linkData.error || ''));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setLinking(false);
  };

  const handleUnlink = async (studentId: string, parentId: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/students/${studentId}/guardians/${parentId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        loadStudents();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo desvincular.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg flex items-start border border-indigo-200 break-all">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <Users2 className="w-4 h-4 text-rose-600" />
          <h2 className="font-bold text-slate-700">Directorio de Alumnos</h2>
          <button
            onClick={() => { setShowAddStudent(!showAddStudent); if (showAddStudent) resetAddStudentForm(); }}
            className="flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Alumno
          </button>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Buscar alumno..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {showAddStudent && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 space-y-3">
            <p className="text-xs text-rose-700">
              Solo lo esencial. El alumno/padre completa el resto (cédula, salud, contactos de emergencia, etc.)
              desde "Actualización de Datos" en el Portal de Padres.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text" placeholder="Nombre" value={newStudentForm.first_name}
                onChange={e => setNewStudentForm({ ...newStudentForm, first_name: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text" placeholder="Apellido" value={newStudentForm.last_name}
                onChange={e => setNewStudentForm({ ...newStudentForm, last_name: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <select
                value={newStudentGradeLevelId}
                onChange={e => { setNewStudentGradeLevelId(e.target.value); setNewStudentSectionId(''); }}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Selecciona el grado...</option>
                {gradeLevels.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select
                value={newStudentSectionId}
                onChange={e => setNewStudentSectionId(e.target.value)}
                disabled={!newStudentGradeLevelId}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
              >
                <option value="">Selecciona la sección...</option>
                {newStudentSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-md border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-500">PADRE/MADRE/ACUDIENTE (opcional, se puede vincular después)</p>
              {addSelectedParent ? (
                <div className="flex items-center justify-between bg-slate-50 rounded-md border border-rose-200 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">{addSelectedParent.first_name} {addSelectedParent.last_name}</span>
                  <button onClick={() => setAddSelectedParent(null)} className="text-xs font-bold text-rose-600 hover:text-rose-800">Cambiar</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" placeholder="Buscar padre existente..." value={addParentSearch}
                    onChange={e => setAddParentSearch(e.target.value)}
                    className="w-full border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {addParentSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {addParentSuggestions.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setAddSelectedParent(p); setAddParentSearch(''); setAddParentSuggestions([]); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                          {p.first_name} {p.last_name} <span className="text-slate-400">({p.email})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <select
                  value={addParentRelationship}
                  onChange={e => setAddParentRelationship(e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {!addSelectedParent && (
                  <button
                    onClick={() => setAddCreatingParent(!addCreatingParent)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800"
                  >
                    {addCreatingParent ? 'Cancelar y buscar existente' : 'No está registrado(a): crear nuevo'}
                  </button>
                )}
              </div>

              {!addSelectedParent && addCreatingParent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text" placeholder="Nombre" value={addNewParentForm.first_name}
                    onChange={e => setAddNewParentForm({ ...addNewParentForm, first_name: e.target.value })}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <input
                    type="text" placeholder="Apellido" value={addNewParentForm.last_name}
                    onChange={e => setAddNewParentForm({ ...addNewParentForm, last_name: e.target.value })}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <input
                    type="email" placeholder="Correo electrónico" value={addNewParentForm.email}
                    onChange={e => setAddNewParentForm({ ...addNewParentForm, email: e.target.value })}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <input
                    type="text" placeholder="Contraseña temporal" value={addNewParentForm.password}
                    onChange={e => setAddNewParentForm({ ...addNewParentForm, password: e.target.value })}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleAddStudent}
              disabled={addingStudent}
              className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
            >
              {addingStudent ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear Alumno
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando alumnos...
          </div>
        ) : groups.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No hay alumnos matriculados{search ? ' que coincidan con la búsqueda' : ' todavía'}.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {groups.map(group => {
              const groupKey = `${group.grade}||${group.section}`;
              const isCollapsed = !!collapsedGroups[groupKey];
              return (
                <div key={groupKey}>
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full text-left px-4 py-2.5 flex items-center justify-between bg-slate-100 hover:bg-slate-200"
                  >
                    <span className="text-sm font-bold text-slate-600">
                      {group.grade} {group.section !== 'Sin sección' && `- ${group.section}`}
                      <span className="ml-2 font-normal text-slate-400">({group.students.length})</span>
                    </span>
                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {group.students.map(student => {
                        const isExpanded = expandedId === student.id;
                        const guardians = (student.parent_students || []).filter(g => g.profiles);
                        return (
                          <div key={student.id}>
                  <button
                    onClick={() => toggleExpanded(student.id)}
                    className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold overflow-hidden">
                        {student.photo_url ? <img src={student.photo_url} alt="" className="w-full h-full object-cover" /> : student.first_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">{student.first_name} {student.last_name}</p>
                        <p className="text-xs text-slate-500">{student.grade || 'Sin grado'} {student.section ? `- ${student.section}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-xs">
                        {guardians.length === 0 ? (
                          <span className="text-xs text-amber-600">Sin padres vinculados</span>
                        ) : (
                          guardians.map((g, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                              {g.profiles?.first_name} ({g.relationship})
                            </span>
                          ))
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 bg-slate-50">
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">PADRES VINCULADOS</p>
                        {guardians.length === 0 ? (
                          <p className="text-sm text-slate-400">Este alumno todavía no tiene padres vinculados.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {guardians.map((g, i) => (
                              <div key={i} className="flex items-center justify-between bg-white rounded-md border border-slate-200 px-3 py-2">
                                <div className="text-sm">
                                  <span className="font-semibold text-slate-700">{g.profiles?.first_name} {g.profiles?.last_name}</span>
                                  <span className="text-slate-400 ml-2">{g.profiles?.email}</span>
                                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">{g.relationship}</span>
                                </div>
                                <button onClick={() => g.profiles && handleUnlink(student.id, g.profiles.id)} className="text-rose-500 hover:text-rose-700 p-1">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white rounded-md border border-slate-200 p-3 space-y-3">
                        <p className="text-xs font-bold text-slate-500 flex items-center"><Link2 className="w-3.5 h-3.5 mr-1.5" /> VINCULAR PADRE EXISTENTE</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text" placeholder="Buscar por nombre o email..." value={parentSearch}
                              onChange={e => { setParentSearch(e.target.value); setSelectedParentId(''); }}
                              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            {parentSuggestions.length > 0 && !selectedParentId && (
                              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {parentSuggestions.map(p => (
                                  <button
                                    key={p.id}
                                    onClick={() => { setSelectedParentId(p.id); setParentSearch(`${p.first_name} ${p.last_name}`); setParentSuggestions([]); }}
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                                  >
                                    {p.first_name} {p.last_name} <span className="text-slate-400">({p.email})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <select
                            value={linkRelationship}
                            onChange={e => setLinkRelationship(e.target.value)}
                            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                          >
                            {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <button
                            onClick={() => handleLinkExisting(student.id)}
                            disabled={linking || !selectedParentId}
                            className="px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
                          >
                            Vincular
                          </button>
                        </div>

                        <button
                          onClick={() => setCreatingParent(!creatingParent)}
                          className="flex items-center text-xs font-bold text-rose-600 hover:text-rose-800"
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> {creatingParent ? 'Cancelar' : 'O crear un padre nuevo'}
                        </button>

                        {creatingParent && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <input
                              type="text" placeholder="Nombre" value={newParentForm.first_name}
                              onChange={e => setNewParentForm({ ...newParentForm, first_name: e.target.value })}
                              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <input
                              type="text" placeholder="Apellido" value={newParentForm.last_name}
                              onChange={e => setNewParentForm({ ...newParentForm, last_name: e.target.value })}
                              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <input
                              type="email" placeholder="Correo electrónico" value={newParentForm.email}
                              onChange={e => setNewParentForm({ ...newParentForm, email: e.target.value })}
                              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <input
                              type="text" placeholder="Contraseña temporal" value={newParentForm.password}
                              onChange={e => setNewParentForm({ ...newParentForm, password: e.target.value })}
                              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <button
                              onClick={() => handleCreateAndLink(student.id)}
                              disabled={linking}
                              className="sm:col-span-2 flex items-center justify-center px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
                            >
                              {linking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                              Crear Padre y Vincular como {RELATIONSHIPS.find(r => r.value === linkRelationship)?.label}
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
