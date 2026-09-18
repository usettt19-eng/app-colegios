import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, Link2, Users2, UserPlus, Briefcase } from 'lucide-react';

interface Props {
  tenantId: string;
}

interface ImportSummary {
  created: number;
  reused?: number;
  linked?: number;
  total: number;
  errors: { row: number; reason: string }[];
}

// Parser de CSV simple: separador coma, soporta campos entre comillas con
// comas internas. Suficiente para exportaciones típicas de sistemas
// escolares (no soporta saltos de línea dentro de un campo).
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
  return lines.slice(1).map(line => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  });
}

const STUDENT_COLUMNS = ['nombre', 'apellido', 'grado', 'seccion', 'codigo_familia', 'cedula', 'fecha_nacimiento'];
const PARENT_COLUMNS = ['nombre', 'apellido', 'email', 'telefono', 'cedula', 'relacion', 'codigo_familia'];
const STAFF_COLUMNS = ['nombre', 'apellido', 'email', 'telefono', 'cedula', 'rol'];

export const BulkImport: React.FC<Props> = ({ tenantId }) => {
  const [studentRows, setStudentRows] = useState<Record<string, string>[]>([]);
  const [parentRows, setParentRows] = useState<Record<string, string>[]>([]);
  const [staffRows, setStaffRows] = useState<Record<string, string>[]>([]);
  const [importingStudents, setImportingStudents] = useState(false);
  const [importingParents, setImportingParents] = useState(false);
  const [importingStaff, setImportingStaff] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [studentSummary, setStudentSummary] = useState<ImportSummary | null>(null);
  const [parentSummary, setParentSummary] = useState<ImportSummary | null>(null);
  const [staffSummary, setStaffSummary] = useState<ImportSummary | null>(null);
  const [message, setMessage] = useState('');

  const readCsvFile = (file: File, onParsed: (rows: Record<string, string>[]) => void) => {
    const reader = new FileReader();
    reader.onload = () => onParsed(parseCsv(String(reader.result || '')));
    reader.readAsText(file);
  };

  const handleImportStudents = async () => {
    if (studentRows.length === 0) return;
    setImportingStudents(true);
    setMessage('');
    setStudentSummary(null);
    try {
      const response = await fetch('/api/v1/bulk-import/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          rows: studentRows.map(r => ({
            first_name: r.nombre, last_name: r.apellido, grade: r.grado, section: r.seccion,
            cedula: r.cedula, birth_date: r.fecha_nacimiento || null, family_code: r.codigo_familia,
          })),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setStudentSummary(data);
        setMessage(`✅ ${data.created} de ${data.total} alumnos importados.`);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo importar el archivo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setImportingStudents(false);
  };

  const handleImportParents = async () => {
    if (parentRows.length === 0) return;
    setImportingParents(true);
    setMessage('');
    setParentSummary(null);
    try {
      const response = await fetch('/api/v1/bulk-import/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          default_password: 'Cambiar123!',
          rows: parentRows.map(r => ({
            first_name: r.nombre, last_name: r.apellido, email: r.email, phone: r.telefono,
            cedula: r.cedula, relationship: r.relacion || 'acudiente', family_code: r.codigo_familia,
          })),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setParentSummary(data);
        setMessage(`✅ ${data.created} padres creados, ${data.reused} ya existían, ${data.linked} vínculos con alumnos creados.`);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo importar el archivo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setImportingParents(false);
  };

  const handleImportStaff = async () => {
    if (staffRows.length === 0) return;
    setImportingStaff(true);
    setMessage('');
    setStaffSummary(null);
    try {
      const response = await fetch('/api/v1/bulk-import/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          default_password: 'Cambiar123!',
          rows: staffRows.map(r => ({
            first_name: r.nombre, last_name: r.apellido, email: r.email, phone: r.telefono,
            cedula: r.cedula, role: r.rol || 'teacher',
          })),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setStaffSummary(data);
        setMessage(`✅ ${data.created} docentes/staff creados, ${data.reused} ya existían.`);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo importar el archivo.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setImportingStaff(false);
  };

  const handleRelink = async () => {
    setRelinking(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/bulk-import/relink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${data.linked} vínculos padre-alumno verificados/creados por código de familia.`);
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo vincular.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setRelinking(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        Para colegios que ya tienen su base de datos, aquí puedes cargar sus alumnos y padres a granel desde archivos CSV
        exportados de su sistema anterior. La relación entre un alumno y sus padres se hace por <strong>código de familia</strong>:
        si un alumno y un padre comparten el mismo código, se vinculan automáticamente.
      </div>

      {message && (
        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg flex items-start border border-indigo-200 break-all">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alumnos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><Users2 className="w-4 h-4 mr-2 text-rose-600" /> 1. Importar Alumnos</h2>
          <p className="text-xs text-slate-500">
            Columnas esperadas (CSV, primera fila con encabezados): <code className="bg-slate-100 px-1 rounded">{STUDENT_COLUMNS.join(', ')}</code>.
            "grado" y "sección" deben coincidir con los ya configurados en Grados y Secciones.
          </p>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-6 cursor-pointer hover:border-rose-400 hover:bg-rose-50">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">{studentRows.length > 0 ? `${studentRows.length} filas cargadas` : 'Selecciona el archivo CSV de alumnos'}</span>
            <input
              type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && readCsvFile(e.target.files[0], setStudentRows)}
            />
          </label>

          {studentRows.length > 0 && (
            <div className="border border-slate-200 rounded-md overflow-x-auto max-h-40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>{STUDENT_COLUMNS.map(c => <th key={c} className="px-2 py-1">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{STUDENT_COLUMNS.map(c => <td key={c} className="px-2 py-1 text-slate-600">{r[c] || '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={handleImportStudents}
            disabled={importingStudents || studentRows.length === 0}
            className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
          >
            {importingStudents ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Importar {studentRows.length > 0 ? `${studentRows.length} Alumnos` : 'Alumnos'}
          </button>

          {studentSummary && (
            <div className="text-xs space-y-1">
              <p className="text-emerald-600 font-semibold">{studentSummary.created} de {studentSummary.total} creados.</p>
              {studentSummary.errors.length > 0 && (
                <div className="text-rose-600">
                  {studentSummary.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="flex items-start"><AlertTriangle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" /> Fila {e.row}: {e.reason}</p>
                  ))}
                  {studentSummary.errors.length > 5 && <p>...y {studentSummary.errors.length - 5} más.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Padres */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><UserPlus className="w-4 h-4 mr-2 text-rose-600" /> 2. Importar Padres</h2>
          <p className="text-xs text-slate-500">
            Columnas esperadas: <code className="bg-slate-100 px-1 rounded">{PARENT_COLUMNS.join(', ')}</code>.
            Se crea una cuenta real por cada padre nuevo (contraseña temporal: <code className="bg-slate-100 px-1 rounded">Cambiar123!</code>),
            y se vincula automáticamente a los alumnos con el mismo código de familia.
          </p>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-6 cursor-pointer hover:border-rose-400 hover:bg-rose-50">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">{parentRows.length > 0 ? `${parentRows.length} filas cargadas` : 'Selecciona el archivo CSV de padres'}</span>
            <input
              type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && readCsvFile(e.target.files[0], setParentRows)}
            />
          </label>

          {parentRows.length > 0 && (
            <div className="border border-slate-200 rounded-md overflow-x-auto max-h-40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>{PARENT_COLUMNS.map(c => <th key={c} className="px-2 py-1">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parentRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{PARENT_COLUMNS.map(c => <td key={c} className="px-2 py-1 text-slate-600">{r[c] || '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={handleImportParents}
            disabled={importingParents || parentRows.length === 0}
            className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
          >
            {importingParents ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Importar {parentRows.length > 0 ? `${parentRows.length} Padres` : 'Padres'}
          </button>

          {parentSummary && (
            <div className="text-xs space-y-1">
              <p className="text-emerald-600 font-semibold">
                {parentSummary.created} creados, {parentSummary.reused} reutilizados, {parentSummary.linked} vínculos con alumnos.
              </p>
              {parentSummary.errors.length > 0 && (
                <div className="text-rose-600">
                  {parentSummary.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="flex items-start"><AlertTriangle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" /> Fila {e.row}: {e.reason}</p>
                  ))}
                  {parentSummary.errors.length > 5 && <p>...y {parentSummary.errors.length - 5} más.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Docentes/Staff */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center"><Briefcase className="w-4 h-4 mr-2 text-rose-600" /> 3. Importar Docentes/Staff</h2>
          <p className="text-xs text-slate-500">
            Columnas esperadas: <code className="bg-slate-100 px-1 rounded">{STAFF_COLUMNS.join(', ')}</code>.
            "rol" debe ser <code className="bg-slate-100 px-1 rounded">teacher</code>, <code className="bg-slate-100 px-1 rounded">admin</code> o <code className="bg-slate-100 px-1 rounded">guard</code> (por defecto "teacher").
            Se crea una cuenta real por cada persona nueva (contraseña temporal: <code className="bg-slate-100 px-1 rounded">Cambiar123!</code>).
          </p>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-6 cursor-pointer hover:border-rose-400 hover:bg-rose-50">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">{staffRows.length > 0 ? `${staffRows.length} filas cargadas` : 'Selecciona el archivo CSV de docentes/staff'}</span>
            <input
              type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && readCsvFile(e.target.files[0], setStaffRows)}
            />
          </label>

          {staffRows.length > 0 && (
            <div className="border border-slate-200 rounded-md overflow-x-auto max-h-40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>{STAFF_COLUMNS.map(c => <th key={c} className="px-2 py-1">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{STAFF_COLUMNS.map(c => <td key={c} className="px-2 py-1 text-slate-600">{r[c] || '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={handleImportStaff}
            disabled={importingStaff || staffRows.length === 0}
            className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 font-semibold text-sm"
          >
            {importingStaff ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Importar {staffRows.length > 0 ? `${staffRows.length} Docentes/Staff` : 'Docentes/Staff'}
          </button>

          {staffSummary && (
            <div className="text-xs space-y-1">
              <p className="text-emerald-600 font-semibold">{staffSummary.created} creados, {staffSummary.reused} ya existían.</p>
              {staffSummary.errors.length > 0 && (
                <div className="text-rose-600">
                  {staffSummary.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="flex items-start"><AlertTriangle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" /> Fila {e.row}: {e.reason}</p>
                  ))}
                  {staffSummary.errors.length > 5 && <p>...y {staffSummary.errors.length - 5} más.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
        <h2 className="font-bold text-slate-700 flex items-center"><Link2 className="w-4 h-4 mr-2 text-rose-600" /> 4. Re-vincular por Código de Familia</h2>
        <p className="text-sm text-slate-500">
          Si importaste los archivos en momentos distintos (o agregaste alumnos/padres después), usa este botón para
          revisar todos los códigos de familia del colegio y crear los vínculos padre-alumno que falten. Es seguro
          correrlo varias veces.
        </p>
        <button
          onClick={handleRelink}
          disabled={relinking}
          className="flex items-center px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 font-semibold text-sm"
        >
          {relinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
          Vincular por Código de Familia
        </button>
      </div>
    </div>
  );
};
