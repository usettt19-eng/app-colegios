import React from 'react';
import { Loader2 } from 'lucide-react';

interface GradeLevel {
  id: string;
  name: string;
  sort_order: number;
}

interface Course {
  id: string;
  code: string;
  name: string;
  area: string | null;
  course_grade_levels?: { grade_level_id: string }[];
}

interface Props {
  tenantId: string;
  courses: Course[];
  gradeLevels: GradeLevel[];
  onChanged: () => void;
}

export const CurriculumMatrix: React.FC<Props> = ({ tenantId, courses, gradeLevels, onChanged }) => {
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);

  const sortedGrades = [...gradeLevels].sort((a, b) => a.sort_order - b.sort_order);

  const groups = React.useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const course of courses) {
      const area = course.area || 'Sin área';
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(course);
    }
    return Array.from(map.entries());
  }, [courses]);

  const isAssigned = (course: Course, gradeId: string) =>
    (course.course_grade_levels || []).some(m => m.grade_level_id === gradeId);

  const toggle = async (course: Course, gradeId: string) => {
    const key = `${course.id}-${gradeId}`;
    setTogglingKey(key);
    try {
      if (isAssigned(course, gradeId)) {
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

  if (courses.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Agrega cursos al catálogo para armar la matriz de plan de estudios.</p>;
  }
  if (sortedGrades.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Configura los grados en "Grados y Secciones" primero.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-xs font-bold text-slate-500">ÁREA</th>
            <th className="px-3 py-2 text-xs font-bold text-slate-500">ASIGNATURA</th>
            {sortedGrades.map(g => (
              <th key={g.id} className="px-3 py-2 text-xs font-bold text-slate-500 text-center whitespace-nowrap">{g.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([area, areaCourses]) => (
            areaCourses.map((course, i) => (
              <tr key={course.id} className="border-b border-slate-100 hover:bg-slate-50">
                {i === 0 && (
                  <td rowSpan={areaCourses.length} className="px-3 py-2 align-top font-bold text-slate-600 text-xs">{area}</td>
                )}
                <td className="px-3 py-2 font-medium text-slate-700">{course.name}</td>
                {sortedGrades.map(g => {
                  const assigned = isAssigned(course, g.id);
                  const key = `${course.id}-${g.id}`;
                  return (
                    <td key={g.id} className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggle(course, g.id)}
                        disabled={togglingKey === key}
                        className={`w-8 h-6 rounded text-xs font-bold ${assigned ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                      >
                        {togglingKey === key ? <Loader2 className="w-3 h-3 mx-auto animate-spin" /> : (assigned ? 'Sí' : '—')}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))
          ))}
        </tbody>
      </table>
    </div>
  );
};
