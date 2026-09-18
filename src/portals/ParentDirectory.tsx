import React, { useEffect, useState } from 'react';
import { Search, UserCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface LinkedStudent {
  relationship: string;
  students: { id: string; first_name: string; last_name: string; grade: string | null; section: string | null } | null;
}

interface Parent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  cedula: string | null;
  parent_students: LinkedStudent[];
}

interface Props {
  tenantId: string;
}

export const ParentDirectory: React.FC<Props> = ({ tenantId }) => {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadParents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/profiles?tenant_id=${tenantId}&role=parent&with_children=true${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      const data = await response.json();
      setParents(data.profiles || []);
    } catch {
      // handled by empty state
    }
    setLoading(false);
  };

  useEffect(() => {
    const timeout = setTimeout(loadParents, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tenantId]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
        <UserCircle2 className="w-4 h-4 text-rose-600" />
        <h2 className="font-bold text-slate-700">Directorio de Padres</h2>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Buscar padre..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando padres...
        </div>
      ) : parents.length === 0 ? (
        <p className="p-6 text-sm text-slate-400">No hay padres registrados{search ? ' que coincidan con la búsqueda' : ' todavía'}.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {parents.map(parent => {
            const isExpanded = expandedId === parent.id;
            const children = (parent.parent_students || []).filter(link => link.students);
            return (
              <div key={parent.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : parent.id)}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                      {parent.first_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">{parent.first_name} {parent.last_name}</p>
                      <p className="text-xs text-slate-500">{parent.email} {parent.phone && `· ${parent.phone}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-xs">
                      {children.length === 0 ? (
                        <span className="text-xs text-amber-600">Sin hijos vinculados</span>
                      ) : (
                        children.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                            {c.students?.first_name} ({c.relationship})
                          </span>
                        ))
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 bg-slate-50 space-y-3">
                    <div className="bg-white rounded-md border border-slate-200 p-3 grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-slate-400">Email:</span> <span className="text-slate-700">{parent.email || '—'}</span></div>
                      <div><span className="text-slate-400">Teléfono:</span> <span className="text-slate-700">{parent.phone || '—'}</span></div>
                      <div><span className="text-slate-400">Cédula:</span> <span className="text-slate-700">{parent.cedula || '—'}</span></div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2">HIJOS VINCULADOS</p>
                      {children.length === 0 ? (
                        <p className="text-sm text-slate-400">Este padre todavía no tiene alumnos vinculados.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {children.map((c, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-md border border-slate-200 px-3 py-2 text-sm">
                              <span className="font-semibold text-slate-700">{c.students?.first_name} {c.students?.last_name}</span>
                              <span className="text-slate-400">{c.students?.grade} {c.students?.section && `- ${c.students.section}`}</span>
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">{c.relationship}</span>
                            </div>
                          ))}
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
};
