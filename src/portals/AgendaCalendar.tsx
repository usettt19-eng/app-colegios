import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from 'lucide-react';

interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  type: 'tarea' | 'examen' | 'actividad' | 'proyecto';
  max_score: number;
  classes?: { name: string; courses?: { name: string } };
}

interface Props {
  studentId: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const TYPE_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  tarea: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700', label: 'Tarea' },
  examen: { dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700', label: 'Examen' },
  actividad: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'Actividad' },
  proyecto: { dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700', label: 'Proyecto' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const AgendaCalendar: React.FC<Props> = ({ studentId }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setSelectedDay(null);
      try {
        const from = toDateKey(monthStart);
        const to = toDateKey(monthEnd);
        const response = await fetch(`/api/v1/assignments/agenda/${studentId}?from=${from}&to=${to}`);
        const data = await response.json();
        if (data.success) {
          setItems(data.agenda || []);
        } else {
          setError(data.error || 'No se pudo cargar la agenda.');
        }
      } catch {
        setError('No se pudo conectar con el servidor SIS.');
      }
      setLoading(false);
    };
    load();
  }, [studentId, monthStart, monthEnd]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    for (const item of items) {
      const key = toDateKey(new Date(item.due_date));
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items]);

  const gridDays = useMemo(() => {
    const days: (Date | null)[] = [];
    const firstWeekday = monthStart.getDay();
    for (let i = 0; i < firstWeekday; i++) days.push(null);
    for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [cursor, monthStart, monthEnd]);

  const todayKey = toDateKey(new Date());
  const selectedItems = selectedDay ? itemsByDay[selectedDay] || [] : [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-bold text-slate-700 w-44 text-center">{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</h2>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(TYPE_STYLES).map(([key, style]) => (
              <span key={key} className="flex items-center gap-1 text-slate-500">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} /> {style.label}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando agenda...
          </div>
        ) : error ? (
          <div className="m-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">{error}</div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-1">
              {DAY_LABELS.map(d => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {gridDays.map((day, i) => {
                if (!day) return <div key={i} className="min-h-[80px] rounded-lg bg-slate-50/50" />;
                const key = toDateKey(day);
                const dayItems = itemsByDay[key] || [];
                const isToday = key === todayKey;
                const isSelected = key === selectedDay;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(dayItems.length > 0 ? key : null)}
                    className={`min-h-[80px] rounded-lg border p-1.5 text-left align-top transition-colors ${
                      isSelected ? 'border-teal-500 bg-teal-50' : isToday ? 'border-teal-300 bg-white' : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-xs font-bold ${isToday ? 'text-teal-600' : 'text-slate-500'}`}>{day.getDate()}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0, 2).map(item => (
                        <div key={item.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${TYPE_STYLES[item.type]?.badge || 'bg-slate-100 text-slate-600'}`}>
                          {item.title}
                        </div>
                      ))}
                      {dayItems.length > 2 && (
                        <div className="text-[10px] text-slate-400 px-1">+{dayItems.length - 2} más</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-teal-600" />
          <h2 className="font-bold text-slate-700">
            {selectedDay ? `Agenda del ${new Date(selectedDay + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Selecciona un día con eventos'}
          </h2>
        </div>
        {!loading && !error && (
          selectedItems.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">
              {selectedDay ? 'No hay tareas ni exámenes ese día.' : 'Haz clic en un día del calendario con eventos para ver el detalle.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {selectedItems.map(item => (
                <div key={item.id} className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TYPE_STYLES[item.type]?.badge || 'bg-slate-100 text-slate-600'}`}>
                        {TYPE_STYLES[item.type]?.label || item.type}
                      </span>
                      <span className="text-xs text-slate-400">{item.classes?.courses?.name || item.classes?.name || 'Materia'}</span>
                    </div>
                    <p className="font-semibold text-slate-700">{item.title}</p>
                    {item.description && <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>}
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">Vale {item.max_score} pts</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
