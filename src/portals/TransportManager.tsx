import React, { useEffect, useState } from 'react';
import { Bus, Plus, Loader2, CheckCircle, ChevronDown, ChevronUp, X, Search, UserCheck } from 'lucide-react';

interface BusRecord {
  id: string;
  name: string;
  plate: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  capacity: number;
  route_description: string | null;
  is_active: boolean;
  student_count: number;
}

interface RosterStudent {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  section: string | null;
  photo_url: string | null;
  bus_stop: string | null;
  bus_direction: string;
}

interface StudentSuggestion {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
  section: string | null;
}

interface Props {
  tenantId: string;
}

const DIRECTIONS = [
  { value: 'ambos', label: 'Ida y Vuelta' },
  { value: 'ida', label: 'Solo Ida' },
  { value: 'vuelta', label: 'Solo Vuelta' },
];

export const TransportManager: React.FC<Props> = ({ tenantId }) => {
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [busForm, setBusForm] = useState({ name: '', plate: '', driver_name: '', driver_phone: '', capacity: '30', route_description: '' });

  const [expandedBusId, setExpandedBusId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState<StudentSuggestion[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSuggestion | null>(null);
  const [busStop, setBusStop] = useState('');
  const [busDirection, setBusDirection] = useState('ambos');
  const [assigning, setAssigning] = useState(false);

  const loadBuses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/transport/buses?tenant_id=${tenantId}`);
      const data = await response.json();
      setBuses(data.buses || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setLoading(false);
  };

  useEffect(() => { loadBuses(); }, [tenantId]);

  useEffect(() => {
    if (!studentSearch || selectedStudent) {
      setStudentSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/v1/students?tenant_id=${tenantId}&search=${encodeURIComponent(studentSearch)}`)
        .then(r => r.json())
        .then(d => setStudentSuggestions(d.students || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [studentSearch, selectedStudent, tenantId]);

  const handleCreateBus = async () => {
    if (!busForm.name) {
      setMessage('❌ El nombre del bus es requerido.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/transport/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...busForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Bus creado.');
        setBusForm({ name: '', plate: '', driver_name: '', driver_phone: '', capacity: '30', route_description: '' });
        loadBuses();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo crear el bus.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setCreating(false);
  };

  const handleDeleteBus = async (id: string) => {
    setMessage('');
    try {
      const response = await fetch(`/api/v1/transport/buses/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setBuses(prev => prev.filter(b => b.id !== id));
        if (expandedBusId === id) setExpandedBusId(null);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo eliminar el bus.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  const loadRoster = async (busId: string) => {
    setRosterLoading(true);
    try {
      const response = await fetch(`/api/v1/transport/buses/${busId}/roster`);
      const data = await response.json();
      setRoster(data.roster || []);
    } catch {
      setMessage('❌ No se pudo cargar el listado de alumnos.');
    }
    setRosterLoading(false);
  };

  const toggleExpanded = (busId: string) => {
    if (expandedBusId === busId) {
      setExpandedBusId(null);
      return;
    }
    setExpandedBusId(busId);
    setStudentSearch('');
    setSelectedStudent(null);
    setBusStop('');
    setBusDirection('ambos');
    loadRoster(busId);
  };

  const handleAssign = async (busId: string) => {
    if (!selectedStudent) {
      setMessage('❌ Busca y selecciona un alumno.');
      return;
    }
    setAssigning(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/transport/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedStudent.id, bus_id: busId, bus_stop: busStop, bus_direction: busDirection }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${selectedStudent.first_name} ${selectedStudent.last_name} asignado(a) al bus.`);
        setStudentSearch('');
        setSelectedStudent(null);
        setBusStop('');
        loadRoster(busId);
        loadBuses();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo asignar al alumno.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setAssigning(false);
  };

  const handleUnassign = async (busId: string, studentId: string) => {
    setMessage('');
    try {
      const response = await fetch('/api/v1/transport/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, bus_id: null }),
      });
      const data = await response.json();
      if (data.success) {
        loadRoster(busId);
        loadBuses();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo desasignar.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg flex items-start border border-indigo-200 break-all">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="font-bold text-slate-700 flex items-center"><Plus className="w-4 h-4 mr-2 text-rose-600" /> Agregar Bus</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text" placeholder="Nombre (ej. Bus 1 - Ruta Norte)" value={busForm.name}
            onChange={e => setBusForm({ ...busForm, name: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 sm:col-span-2"
          />
          <input
            type="text" placeholder="Placa" value={busForm.plate}
            onChange={e => setBusForm({ ...busForm, plate: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <input
            type="text" placeholder="Nombre del chofer" value={busForm.driver_name}
            onChange={e => setBusForm({ ...busForm, driver_name: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <input
            type="text" placeholder="Teléfono del chofer" value={busForm.driver_phone}
            onChange={e => setBusForm({ ...busForm, driver_phone: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <input
            type="number" placeholder="Capacidad" value={busForm.capacity}
            onChange={e => setBusForm({ ...busForm, capacity: e.target.value })}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <input
          type="text" placeholder="Descripción de la ruta (opcional)" value={busForm.route_description}
          onChange={e => setBusForm({ ...busForm, route_description: e.target.value })}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
        <button
          onClick={handleCreateBus}
          disabled={creating}
          className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
        >
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Agregar Bus
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center">
          <Bus className="w-4 h-4 mr-2 text-rose-600" />
          <h2 className="font-bold text-slate-700">Buses del Colegio</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando buses...
          </div>
        ) : buses.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no hay buses configurados.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {buses.map(bus => {
              const isExpanded = expandedBusId === bus.id;
              return (
                <div key={bus.id}>
                  <button
                    onClick={() => toggleExpanded(bus.id)}
                    className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
                        <Bus className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">{bus.name} {bus.plate && <span className="text-slate-400 font-normal">({bus.plate})</span>}</p>
                        <p className="text-xs text-slate-500">
                          {bus.driver_name || 'Sin chofer asignado'} · {bus.student_count}/{bus.capacity} alumnos
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteBus(bus.id); }}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                        title="Eliminar bus"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 bg-slate-50">
                      {bus.route_description && <p className="text-xs text-slate-500 italic">{bus.route_description}</p>}

                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">ALUMNOS ASIGNADOS</p>
                        {rosterLoading ? (
                          <div className="flex items-center text-sm text-slate-400"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cargando...</div>
                        ) : roster.length === 0 ? (
                          <p className="text-sm text-slate-400">Este bus todavía no tiene alumnos asignados.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {roster.map(s => (
                              <div key={s.id} className="flex items-center justify-between bg-white rounded-md border border-slate-200 px-3 py-2">
                                <div className="text-sm">
                                  <span className="font-semibold text-slate-700">{s.first_name} {s.last_name}</span>
                                  <span className="text-slate-400 ml-2">{s.grade} {s.section && `- ${s.section}`}</span>
                                  {s.bus_stop && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">{s.bus_stop}</span>}
                                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">{s.bus_direction}</span>
                                </div>
                                <button onClick={() => handleUnassign(bus.id, s.id)} className="text-rose-500 hover:text-rose-700 p-1">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white rounded-md border border-slate-200 p-3 space-y-2">
                        <p className="text-xs font-bold text-slate-500 flex items-center"><UserCheck className="w-3.5 h-3.5 mr-1.5" /> ASIGNAR ALUMNO</p>
                        {selectedStudent ? (
                          <div className="flex items-center justify-between bg-slate-50 rounded-md border border-rose-200 px-3 py-2">
                            <span className="text-sm font-semibold text-slate-700">{selectedStudent.first_name} {selectedStudent.last_name}</span>
                            <button onClick={() => setSelectedStudent(null)} className="text-xs font-bold text-rose-600 hover:text-rose-800">Cambiar</button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text" placeholder="Buscar alumno por nombre..." value={studentSearch}
                              onChange={e => setStudentSearch(e.target.value)}
                              className="w-full border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            {studentSuggestions.length > 0 && (
                              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {studentSuggestions.map(s => (
                                  <button
                                    key={s.id}
                                    onClick={() => { setSelectedStudent(s); setStudentSearch(''); setStudentSuggestions([]); }}
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                                  >
                                    {s.first_name} {s.last_name} <span className="text-slate-400">({s.grade} {s.section})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text" placeholder="Parada (ej. Vía España)" value={busStop}
                            onChange={e => setBusStop(e.target.value)}
                            className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                          <select
                            value={busDirection}
                            onChange={e => setBusDirection(e.target.value)}
                            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                          >
                            {DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                          </select>
                          <button
                            onClick={() => handleAssign(bus.id)}
                            disabled={assigning || !selectedStudent}
                            className="px-3 py-1.5 bg-rose-600 text-white rounded-md text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
                          >
                            Asignar
                          </button>
                        </div>
                      </div>
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
