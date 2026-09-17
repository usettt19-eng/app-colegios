import React, { useState } from 'react';
import { Users, Calendar, CheckSquare, AlertTriangle, Send } from 'lucide-react';

const MOCK_STUDENTS = [
  { id: '1', name: 'Ana Gómez', status: 'present' },
  { id: '2', name: 'Carlos Ruiz', status: 'present' },
  { id: '3', name: 'Lucía Fernández', status: 'present' },
  { id: '4', name: 'Mateo Herrera', status: 'present' },
];

export const TeacherPortal: React.FC = () => {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const toggleStatus = (id: string, newStatus: string) => {
    setStudents(students.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  const submitAttendance = async () => {
    setIsSubmitting(true);
    setMessage('');
    try {
      // Llamada real al backend que construimos
      const response = await fetch('/api/v1/attendance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: 'tenant-demo-123', // Hardcodeado por ahora
          class_id: 'class-demo-123',
          teacher_id: 'teacher-demo-123',
          records: students.map(s => ({ student_id: s.id, status: s.status }))
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Portal del Docente</h1>
          <p className="text-gray-500">Matemáticas 4to Grado - Grupo A</p>
        </div>
        <div className="flex space-x-2 text-sm text-gray-600">
          <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center">
          <CheckSquare className="w-5 h-5 text-indigo-600 mr-2" />
          <h2 className="font-semibold text-indigo-900">Pase de Lista Diario</h2>
        </div>
        
        <div className="divide-y divide-gray-100">
          {students.map((student) => (
            <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{student.name}</p>
                  <p className="text-xs text-gray-500">ID: {student.id}</p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={() => toggleStatus(student.id, 'present')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${student.status === 'present' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  Presente
                </button>
                <button 
                  onClick={() => toggleStatus(student.id, 'late')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${student.status === 'late' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  Atraso
                </button>
                <button 
                  onClick={() => toggleStatus(student.id, 'absent')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${student.status === 'absent' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  Ausente
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <div className="text-sm">
            {message && <span className="font-medium text-indigo-600">{message}</span>}
          </div>
          <button 
            onClick={submitAttendance}
            disabled={isSubmitting}
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
    </div>
  );
};
