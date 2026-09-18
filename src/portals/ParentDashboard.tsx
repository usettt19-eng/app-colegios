import React, { useEffect, useState } from 'react';
import { DollarSign, ClipboardList, CalendarClock, BarChart3, ChevronRight, Loader2 } from 'lucide-react';

interface DashboardData {
  student: { name: string; grade: string | null; section: string | null };
  financial: { balance: number; status: 'moroso' | 'al_dia' };
  general: { term_name: string | null; advisor_name: string | null };
  assignments_agenda: {
    current_week: { start: string; end: string; count: number };
    next_week: { start: string; end: string; count: number };
    month: { start: string; end: string; count: number };
  };
  period: { name: string; start_date: string; end_date: string; days_remaining: number } | null;
  academic_index: { by_term: { term_name: string; gpa: number }[]; accumulated: number | null };
}

interface Props {
  tenantId: string;
  studentId: string;
  onGoToPayments: () => void;
  onGoToAgenda: () => void;
  onGoToGrades: () => void;
  academicIndexBlocked?: boolean;
}

const fmtRange = (start: string, end: string) => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `${s.toLocaleDateString('es', opts)} - ${e.toLocaleDateString('es', opts)}`;
};

export const ParentDashboard: React.FC<Props> = ({ tenantId, studentId, onGoToPayments, onGoToAgenda, onGoToGrades, academicIndexBlocked }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/v1/students/${studentId}/dashboard?tenant_id=${tenantId}`);
        const result = await response.json();
        if (result.success) {
          setData(result.dashboard);
        } else {
          setError(result.error || 'No se pudo cargar el resumen ejecutivo.');
        }
      } catch {
        setError('No se pudo conectar con el servidor SIS.');
      }
      setLoading(false);
    };
    load();
  }, [tenantId, studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 mr-2 animate-spin" /> Cargando resumen ejecutivo...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-sm text-amber-800">
        {error || 'Sin datos disponibles.'}
      </div>
    );
  }

  const { student, financial, general, assignments_agenda, period, academic_index } = data;

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-500">
        {student.name} · {student.grade} {student.section && `- ${student.section}`}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Información Financiera */}
        <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${financial.status === 'moroso' ? 'border-rose-300' : 'border-slate-200'}`}>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className={`p-2 rounded-lg ${financial.status === 'moroso' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                <DollarSign className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-slate-700">Información Financiera</h2>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500">Estado</span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${financial.status === 'moroso' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {financial.status === 'moroso' ? 'Moroso' : 'Al Día'}
              </span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-slate-500">Balance Actual</span>
              <span className="font-bold text-slate-800">USD {financial.balance.toFixed(2)}</span>
            </div>
            <button onClick={onGoToPayments} className="flex items-center text-sm font-semibold text-rose-600 hover:text-rose-800">
              Ver detalle de cuenta <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Datos Generales */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><ClipboardList className="w-4 h-4" /></div>
              <h2 className="font-bold text-slate-700">Datos Generales</h2>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500">Nivel</span>
              <span className="font-semibold text-slate-700">{student.grade || '—'}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500">Grupo</span>
              <span className="font-semibold text-slate-700">{student.section || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Consejero</span>
              <span className="font-semibold text-slate-700">{general.advisor_name || 'Sin asignar'}</span>
            </div>
          </div>
        </div>

        {/* Agenda de Deberes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-600"><CalendarClock className="w-4 h-4" /></div>
              <h2 className="font-bold text-slate-700">Agenda de Deberes</h2>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500">Actual</span>
              <span className="text-sm font-semibold text-slate-700">{fmtRange(assignments_agenda.current_week.start, assignments_agenda.current_week.end)} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-xs">{assignments_agenda.current_week.count}</span></span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500">Próxima</span>
              <span className="text-sm font-semibold text-slate-700">{fmtRange(assignments_agenda.next_week.start, assignments_agenda.next_week.end)} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-xs">{assignments_agenda.next_week.count}</span></span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-slate-500">Mes</span>
              <span className="text-sm font-semibold text-slate-700">{fmtRange(assignments_agenda.month.start, assignments_agenda.month.end)} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-xs">{assignments_agenda.month.count}</span></span>
            </div>
            <button onClick={onGoToAgenda} className="flex items-center text-sm font-semibold text-rose-600 hover:text-rose-800">
              Ver calendario de pruebas <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Información del Período */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-violet-100 text-violet-600"><ClipboardList className="w-4 h-4" /></div>
              <h2 className="font-bold text-slate-700">Información del Periodo</h2>
            </div>
            {period ? (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Periodo</span>
                  <span className="font-semibold text-slate-700">{period.name}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Días Restantes</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{period.days_remaining}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500">Inicia</span>
                  <span className="text-sm text-slate-700">{period.start_date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Finaliza</span>
                  <span className="text-sm text-slate-700">{period.end_date}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">No hay un ciclo escolar activo configurado.</p>
            )}
          </div>
        </div>

        {/* Índice Académico */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><BarChart3 className="w-4 h-4" /></div>
              <h2 className="font-bold text-slate-700">Índice Académico</h2>
            </div>
            {academicIndexBlocked ? (
              <p className="text-sm text-rose-500 mb-4">Oculto por mora. Regulariza tu situación en el Centro de Pagos para verlo.</p>
            ) : academic_index.by_term.length === 0 ? (
              <p className="text-sm text-slate-400 mb-4">Aún no hay boletines publicados.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {academic_index.by_term.map((t, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">{t.term_name}</span>
                    <span className="font-bold text-emerald-600">{t.gpa.toFixed(3)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Acumulativo</span>
                  <span className="font-bold text-emerald-600">{academic_index.accumulated?.toFixed(3) ?? '—'}</span>
                </div>
              </div>
            )}
            <button onClick={academicIndexBlocked ? onGoToPayments : onGoToGrades} className="flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800">
              {academicIndexBlocked ? 'Ir al Centro de Pagos' : 'Ver detalle por materia'} <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
