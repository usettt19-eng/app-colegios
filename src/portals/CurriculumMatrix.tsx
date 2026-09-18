import React from 'react';
import { Loader2 } from 'lucide-react';

interface GradeLevel {
  id: string;
  name: string;
  sort_order: number;
}

interface CourseGradeLevel {
  grade_level_id: string;
  weekly_hours: number | null;
}

interface Course {
  id: string;
  code: string;
  name: string;
  area: string | null;
  course_grade_levels?: CourseGradeLevel[];
}

interface Props {
  tenantId: string;
  courses: Course[];
  gradeLevels: GradeLevel[];
  onChanged: () => void;
}

// Muestra la matriz de plan de estudios de UN grado a la vez (seleccionable),
// porque un colegio puede tener 13+ grados y las materias/horas de cada uno
// no son las mismas (ej. Matemática de 1ro no es igual a Matemática de 5to).
export const CurriculumMatrix: React.FC<Props> = ({ tenantId, courses, gradeLevels, onChanged }) => {
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);
  const [hoursDraft, setHoursDraft] = React.useState<Record<string, string>>({});

  const sortedGrades = [...gradeLevels].sort((a, b) => a.sort_order - b.sort_order);
  const [selectedGradeId, setSelectedGradeId] = React.useState('');

  React.useEffect(() => {
    if (!selectedGradeId && sortedGrades.length > 0) setSelectedGradeId(sortedGrades[0].id);
  }, [sortedGrades, selectedGradeId]);

  const groups = React.useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const course of courses) {
      const area = course.area || 'Sin área';
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(course);
    }
    return Array.from(map.entries());
  }, [courses]);

  const getAssignment = (course: Course, gradeId: string) =>
    (course.course_grade_levels || []).find(m => m.grade_level_id === gradeId) || null;

  const toggle = async (course: Course, gradeId: string) => {
    const key = `${course.id}-${gradeId}`;
    setTogglingKey(key);
    try {
      if (getAssignment(course, gradeId)) {
        await fetch(`/api/v1/academics/courses/${course.id}/grade-levels/${gradeId}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/v1/academics/courses/${course.id}/grade-levels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenantId, grade_level_id: gradeId }),
        });
      }
      onChanged();
    } catch {
      // El estado se refresca de todos modos vía onChanged() en el próximo intento
    }
    setTogglingKey(null);
  };

  const saveHours = async (course: Course, gradeId: string, value: string) => {
    const key = `${course.id}-${gradeId}`;
    setTogglingKey(key);
    try {
      await fetch(`/api/v1/academics/courses/${course.id}/grade-levels/${gradeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_hours: value ? Number(value) : null }),
      });
      onChanged();
    } catch {
      // El estado se refresca de todos modos vía onChanged() en el próximo intento
    }
    setTogglingKey(null);
  };

  if (courses.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Agrega cursos al catálogo para armar la matriz de plan de estudios.</p>;
  }
  if (sortedGrades.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Configura los grados en "Grados y Secciones" primero.</p>;
  }

  return (
    <div className="space-y-3">
      <select
        value={selectedGradeId}
        onChange={e => setSelectedGradeId(e.target.value)}
        className="border border-slate-300 rounded-md px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
      >
        {sortedGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-xs font-bold text-slate-500">ÁREA</th>
              <th className="px-3 py-2 text-xs font-bold text-slate-500">ASIGNATURA</th>
              <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center">APLICA</th>
              <th className="px-3 py-2 text-xs font-bold text-slate-500 text-center whitespace-nowrap">HORAS/SEMANA</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([area, areaCourses]) => (
              areaCourses.map((course, i) => {
                const assignment = getAssignment(course, selectedGradeId);
                const key = `${course.id}-${selectedGradeId}`;
                const hoursValue = hoursDraft[key] ?? (assignment?.weekly_hours ?? '');
                return (
                  <tr key={course.id} className="border-b border-slate-100 hover:bg-slate-50">
                    {i === 0 && (
                      <td rowSpan={areaCourses.length} className="px-3 py-2 align-top font-bold text-slate-600 text-xs">{area}</td>
                    )}
                    <td className="px-3 py-2 font-medium text-slate-700">{course.name}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggle(course, selectedGradeId)}
                        disabled={togglingKey === key}
                        className={`w-8 h-6 rounded text-xs font-bold ${assignment ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                      >
                        {togglingKey === key ? <Loader2 className="w-3 h-3 mx-auto animate-spin" /> : (assignment ? 'Sí' : '—')}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {assignment ? (
                        <input
                          type="number" step="0.5" min="0" placeholder="—"
                          value={hoursValue}
                          onChange={e => setHoursDraft({ ...hoursDraft, [key]: e.target.value })}
                          onBlur={e => saveHours(course, selectedGradeId, e.target.value)}
                          className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
