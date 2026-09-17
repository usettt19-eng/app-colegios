import React, { useState } from "react";
import { Database, Key, TableProperties, Eye, Code, Cpu, ChevronRight, Copy, Check, Info } from "lucide-react";
import { DBTable } from "../types";

// Conceptual Database tables configuration as requested
const DB_SCHEMAS: DBTable[] = [
  {
    name: "estudiantes",
    description: "Expediente digital 'vivo' del alumno. Almacena información personal, familiar, histórica y su nivel académico actual.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Identificador único incremental o UUID del estudiante." },
      { name: "nombres", type: "VARCHAR(100)", nullable: false, description: "Nombres completos del estudiante." },
      { name: "apellidos", type: "VARCHAR(100)", nullable: false, description: "Apellidos completos del estudiante." },
      { name: "dni_pasaporte", type: "VARCHAR(20)", nullable: false, description: "Documento de identidad nacional para trámites ministeriales." },
      { name: "email", type: "VARCHAR(150)", nullable: true, description: "Correo electrónico institucional o de contacto." },
      { name: "fecha_nacimiento", type: "DATE", nullable: false, description: "Fecha de nacimiento (usada para control de rangos de edad)." },
      { name: "representante_nombre", type: "VARCHAR(150)", nullable: false, description: "Nombre completo del padre, madre o tutor legal." },
      { name: "representante_telefono", type: "VARCHAR(20)", nullable: false, description: "Teléfono del tutor para recibir notificaciones SMS de ausencias." },
      { name: "representante_email", type: "VARCHAR(150)", nullable: false, description: "Email de contacto para avisos disciplinarios y facturas." },
      { name: "nivel_academico", type: "VARCHAR(30)", nullable: false, description: "Grado escolar (ej: 'K-12_Primaria_5to', 'Univ_IngSistemas_3er')." },
      { name: "estado", type: "VARCHAR(20)", nullable: false, description: "Estatus escolar: ACTIVO, ADMITIDO, EGRESADO, RETIRADO." }
    ],
    relationships: ["matriculas.estudiante_id", "asistencias.estudiante_id", "calificaciones.estudiante_id", "facturas.estudiante_id"]
  },
  {
    name: "matriculas",
    description: "Registra la formalización académica del estudiante en un ciclo lectivo. Vincula expedientes con planes curriculares y firma de contratos.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Código de matrícula oficial (ej: MAT-2026-X10)." },
      { name: "estudiante_id", type: "UUID", key: "FK", nullable: false, references: "estudiantes.id", description: "Vínculo al expediente del estudiante." },
      { name: "periodo_lectivo", type: "VARCHAR(20)", nullable: false, description: "Ciclo lectivo activo (ej: '2026-2027')." },
      { name: "fecha_registro", type: "TIMESTAMP", nullable: false, description: "Fecha exacta de realización del trámite." },
      { name: "requisitos_completos", type: "BOOLEAN", nullable: false, description: "Bandera que indica validación física de documentación histórica." },
      { name: "contrato_firmado", type: "BOOLEAN", nullable: false, description: "Indicador de validación de firma digital del representante legal." },
      { name: "hash_contrato", type: "VARCHAR(64)", nullable: true, description: "Identificador seguro de la firma electrónica ante el proveedor." }
    ],
    relationships: ["estudiantes.id -> FK"]
  },
  {
    name: "profesores",
    description: "Almacena los expedientes del personal docente, especialidades académicas y control de carga de trabajo.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Identificador único del docente." },
      { name: "nombres", type: "VARCHAR(100)", nullable: false, description: "Nombres completos del profesor." },
      { name: "apellidos", type: "VARCHAR(100)", nullable: false, description: "Apellidos completos del profesor." },
      { name: "especialidad", type: "VARCHAR(100)", nullable: false, description: "Área de especialización docente (Matemáticas, Programación, etc.)." },
      { name: "email", type: "VARCHAR(150)", nullable: false, description: "Correo institucional de contacto." },
      { name: "carga_horas_max", type: "INTEGER", nullable: false, description: "Carga de horas semanal máxima permitida por contrato laboral." },
      { name: "estado", type: "VARCHAR(20)", nullable: false, description: "Estado contractual: ACTIVO, LICENCIA, BAJA." }
    ],
    relationships: ["carga_horaria.profesor_id"]
  },
  {
    name: "carga_horaria",
    description: "Motor del distributivo académico (Master Schedule). Asigna horas semanales, materias, aulas, profesores y cursos sin solapamiento.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Identificador del distributivo asignado." },
      { name: "profesor_id", type: "UUID", key: "FK", nullable: false, references: "profesores.id", description: "Profesor que imparte la materia." },
      { name: "materia_nombre", type: "VARCHAR(80)", nullable: false, description: "Nombre de la materia curricular." },
      { name: "curso_nombre", type: "VARCHAR(50)", nullable: false, description: "Grado/Paralelo asignado (ej: 'Quinto de Básica A')." },
      { name: "dia_semana", type: "INTEGER", nullable: false, description: "Día de la semana (1-Lunes, 5-Viernes)." },
      { name: "hora_inicio", type: "TIME", nullable: false, description: "Hora de inicio de la cátedra." },
      { name: "hora_fin", type: "TIME", nullable: false, description: "Hora de finalización." },
      { name: "aula", type: "VARCHAR(30)", nullable: false, description: "Aula física asignada para evitar solapamientos." }
    ],
    relationships: ["profesores.id -> FK"]
  },
  {
    name: "asistencias",
    description: "Registro de control diario de ausencias por materia. Soporta alertas ante patrones de deserción y faltas acumuladas.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Identificador del registro de asistencia diario." },
      { name: "estudiante_id", type: "UUID", key: "FK", nullable: false, references: "estudiantes.id", description: "Estudiante asociado." },
      { name: "carga_horaria_id", type: "UUID", key: "FK", nullable: false, references: "carga_horaria.id", description: "Período o clase específica donde se pasa lista." },
      { name: "fecha", type: "DATE", nullable: false, description: "Fecha de la asistencia escolar." },
      { name: "estado", type: "VARCHAR(15)", nullable: false, description: "Asistencia: PRESENTE, AUSENTE, TARDE, JUSTIFICADO." },
      { name: "observaciones", type: "TEXT", nullable: true, description: "Comentarios sobre ausencias o justificaciones formales." },
      { name: "alerta_enviada", type: "BOOLEAN", nullable: false, description: "Indica si se disparó la alerta automatizada SMS/Push al representante." }
    ],
    relationships: ["estudiantes.id -> FK", "carga_horaria.id -> FK"]
  },
  {
    name: "calificaciones",
    description: "Libro de calificaciones digital (LMS Integrado). Realiza cálculos de medias ponderadas automáticas según parámetros configurables.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Identificador del registro de nota." },
      { name: "estudiante_id", type: "UUID", key: "FK", nullable: false, references: "estudiantes.id", description: "Estudiante evaluado." },
      { name: "carga_horaria_id", type: "UUID", key: "FK", nullable: false, references: "carga_horaria.id", description: "Clase o materia curricular asociada." },
      { name: "parcial_id", type: "VARCHAR(20)", nullable: false, description: "Sub-período evaluativo (Ej: 'Primer_Parcial', 'Examen_Final')." },
      { name: "nota_deberes", type: "DECIMAL(4,2)", nullable: true, description: "Promedio de deberes y tareas escolares." },
      { name: "nota_lecciones", type: "DECIMAL(4,2)", nullable: true, description: "Promedio de lecciones y portafolio de clases." },
      { name: "nota_examen", type: "DECIMAL(4,2)", nullable: true, description: "Calificación de la prueba sumativa formal." },
      { name: "nota_final_ponderada", type: "DECIMAL(4,2)", nullable: false, description: "Cálculo resultante automático ponderado por la lógica del curso." }
    ],
    relationships: ["estudiantes.id -> FK", "carga_horaria.id -> FK"]
  },
  {
    name: "facturas",
    description: "Control de colegiaturas recurrentes, mora, planes de pago y descuentos estudiantiles vinculados a becas institucionales.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Folio fiscal interno o referencia de facturación." },
      { name: "estudiante_id", type: "UUID", key: "FK", nullable: false, references: "estudiantes.id", description: "Estudiante receptor del cobro." },
      { name: "concepto", type: "VARCHAR(150)", nullable: false, description: "Descripción del cobro (ej: 'Matrícula Anual', 'Colegiatura Marzo 2026')." },
      { name: "monto_bruto", type: "DECIMAL(10,2)", nullable: false, description: "Monto base sin subsidios ni becas." },
      { name: "porcentaje_beca", type: "DECIMAL(5,2)", nullable: false, description: "Porcentaje de descuento aplicado por becas asignadas." },
      { name: "monto_neto", type: "DECIMAL(10,2)", nullable: false, description: "Monto final a recaudar." },
      { name: "estado_pago", type: "VARCHAR(20)", nullable: false, description: "Estatus actual: PAGADO, PENDIENTE, VENCIDO, ANULADO." },
      { name: "fecha_vencimiento", type: "DATE", nullable: false, description: "Fecha límite para el pago sin mora." },
      { name: "fecha_recaudo", type: "TIMESTAMP", nullable: true, description: "Fecha exacta en que se liquidó con pasarela digital." }
    ],
    relationships: ["estudiantes.id -> FK"]
  },
  {
    name: "documentos_oficiales",
    description: "Historial de titulación electrónica, cuadros de honor y emisión de boletas digitales oficiales.",
    columns: [
      { name: "id", type: "UUID", key: "PK", nullable: false, description: "Código de verificación e id del documento." },
      { name: "estudiante_id", type: "UUID", key: "FK", nullable: false, references: "estudiantes.id", description: "Estudiante titular." },
      { name: "tipo_documento", type: "VARCHAR(50)", nullable: false, description: "Tipo: CERTIFICADO_PROMOCION, BOLETA_NOTAS, TITULO_ELECTRONICO." },
      { name: "fecha_emision", type: "TIMESTAMP", nullable: false, description: "Fecha de generación instantánea." },
      { name: "firma_digital_director", type: "VARCHAR(128)", nullable: false, description: "Firma electrónica cifrada del representante de la institución." },
      { name: "validado_ministerio", type: "BOOLEAN", nullable: false, description: "Indica si el certificado ya fue reportado al ministerio gubernamental." }
    ],
    relationships: ["estudiantes.id -> FK"]
  }
];

export default function DatabaseSchemaExplorer() {
  const [selectedTableIdx, setSelectedTableIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"visual" | "sql" | "ai_gen">("visual");
  const [copied, setCopied] = useState<boolean>(false);
  
  // AI Table generation states
  const [aiModule, setAiModule] = useState<string>("admisiones");
  const [aiType, setAiType] = useState<string>("sql");
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");

  const activeTable = DB_SCHEMAS[selectedTableIdx];

  const handleCopySQL = () => {
    let sqlText = `-- PostgreSQL DDL para el Sistema SIS / ERP\n\n`;
    DB_SCHEMAS.forEach(table => {
      sqlText += `CREATE TABLE ${table.name} (\n`;
      const cols = table.columns.map(col => {
        let line = `  ${col.name} ${col.type}`;
        if (col.key === "PK") line += " PRIMARY KEY";
        if (!col.nullable) line += " NOT NULL";
        if (col.references) line += ` REFERENCES ${col.references}`;
        return line;
      });
      sqlText += cols.join(",\n");
      sqlText += `\n);\n\n`;
    });

    navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySingleSQL = () => {
    let sqlText = `CREATE TABLE ${activeTable.name} (\n`;
    const cols = activeTable.columns.map(col => {
      let line = `  ${col.name} ${col.type}`;
      if (col.key === "PK") line += " PRIMARY KEY";
      if (!col.nullable) line += " NOT NULL";
      if (col.references) line += ` REFERENCES ${col.references}`;
      return line + ` -- ${col.description}`;
    });
    sqlText += cols.join(",\n");
    sqlText += `\n);`;

    navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAIGenerate = async () => {
    setGenerating(true);
    setAiError("");
    setGeneratedCode("");
    try {
      const response = await fetch("/api/ai/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: aiModule, type: aiType }),
      });
      const data = await response.json();
      if (data.error) {
        setAiError(data.error);
      } else {
        setGeneratedCode(data.code);
      }
    } catch (err: any) {
      setAiError(err.message || "Error al conectar con la API de IA.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div id="database-schema-explorer" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Tables sidebar navigation */}
      <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-indigo-400" />
          Tablas Core SIS
        </h3>
        <div className="space-y-1 overflow-y-auto max-h-[420px] pr-1">
          {DB_SCHEMAS.map((table, idx) => (
            <button
              key={table.name}
              onClick={() => setSelectedTableIdx(idx)}
              className={`w-full text-left p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all duration-200 ${
                selectedTableIdx === idx
                  ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-200"
                  : "bg-slate-950/20 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <TableProperties className={`w-3.5 h-3.5 ${selectedTableIdx === idx ? "text-indigo-400" : "text-slate-500"}`} />
                <span>{table.name}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-4 mt-auto">
          <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Integridad Referencial
            </h4>
            <p className="text-[10px] text-slate-500 leading-normal">
              Todas las tablas están normalizadas bajo la Tercera Forma Normal (3FN), vinculando notas, ausencias y facturas mediante claves foráneas fuertes en cascada para evitar registros huérfanos.
            </p>
          </div>
        </div>
      </div>

      {/* Database Main details */}
      <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div>
          {/* Tabs header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("visual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                  activeTab === "visual"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Diccionario de Entidades
              </button>
              <button
                onClick={() => setActiveTab("sql")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                  activeTab === "sql"
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Esquema SQL DDL
              </button>
              <button
                onClick={() => setActiveTab("ai_gen")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                  activeTab === "ai_gen"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Generador de Esquemas con AI
              </button>
            </div>

            {activeTab === "sql" && (
              <button
                onClick={handleCopySQL}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "¡Copiado!" : "Copiar Todo el Script"}
              </button>
            )}
          </div>

          {/* Active Tab rendering */}
          {activeTab === "visual" && (
            <div>
              <div className="mb-4">
                <h4 className="text-base font-bold text-white flex items-center gap-1.5">
                  Tabla: {activeTable.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{activeTable.description}</p>
              </div>

              {/* Table Schema columns list */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-3">Columna</th>
                      <th className="p-3">Tipo de Dato</th>
                      <th className="p-3 text-center">Clave</th>
                      <th className="p-3 text-center">Nulo</th>
                      <th className="p-3">Descripción de Campo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeTable.columns.map(col => (
                      <tr key={col.name} className="hover:bg-slate-900/40 text-slate-300">
                        <td className="p-3 font-mono font-bold text-slate-200">{col.name}</td>
                        <td className="p-3 font-mono text-indigo-300">{col.type}</td>
                        <td className="p-3 text-center">
                          {col.key === "PK" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-[9px] font-bold rounded-md">
                              <Key className="w-2.5 h-2.5" /> PK
                            </span>
                          )}
                          {col.key === "FK" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[9px] font-bold rounded-md">
                              <Key className="w-2.5 h-2.5" /> FK
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center text-slate-500">{col.nullable ? "SÍ" : "NO"}</td>
                        <td className="p-3 text-slate-400">{col.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Relationships section */}
              <div className="mt-4 p-3.5 bg-slate-950/60 rounded-lg border border-slate-800/40">
                <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  Relaciones e Índices de Integridad
                </h5>
                <div className="flex flex-wrap gap-2">
                  {activeTable.relationships.map(rel => (
                    <span
                      key={rel}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300"
                    >
                      {rel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "sql" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">
                  Script DDL de PostgreSQL generado automáticamente para la tabla <strong>{activeTable.name}</strong>
                </span>
                <button
                  onClick={handleCopySingleSQL}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copiar esta tabla
                </button>
              </div>
              <pre className="text-xs font-mono text-slate-300 bg-slate-950 p-4 rounded-lg overflow-x-auto max-h-[350px] border border-slate-800 leading-relaxed">
                {`CREATE TABLE ${activeTable.name} (\n` +
                  activeTable.columns
                    .map(col => {
                      let line = `  ${col.name} ${col.type}`;
                      if (col.key === "PK") line += " PRIMARY KEY";
                      if (!col.nullable) line += " NOT NULL";
                      if (col.references) line += ` REFERENCES ${col.references}`;
                      return `${line.padEnd(40, " ")} -- ${col.description}`;
                    })
                    .join(",\n") +
                  `\n);`}
              </pre>
            </div>
          )}

          {activeTab === "ai_gen" && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs leading-relaxed">
                ¿Necesitas extender la base de datos para una funcionalidad escolar específica (ej: Transporte escolar, Biblioteca, Comedor, Actividades extraescolares)? Configura abajo y pídele a Gemini que diseñe las tablas, llaves foráneas e índices apropiados.
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-lg border border-slate-800/80">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Módulo de Destino
                  </label>
                  <select
                    value={aiModule}
                    onChange={(e) => setAiModule(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="Biblioteca Escolar">Biblioteca & Inventario de Textos</option>
                    <option value="Transporte y Rutas">Transporte Escolar y Logística de Rutas</option>
                    <option value="Comedor y Nutrición">Comedor, Cafetería y Planes de Alimentos</option>
                    <option value="Servicio Médico y Salud">Fichas Médicas y Alergias de Estudiantes</option>
                    <option value="Talleres y Deportes">Inscripciones a Actividades Extraescolares</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Tipo de Estructura Requerida
                  </label>
                  <select
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="sql">Script SQL DDL PostgreSQL completo</option>
                    <option value="migration">Esquema TypeScript Drizzle ORM</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleAIGenerate}
                disabled={generating}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-indigo-300 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Cpu className="w-4 h-4" />
                {generating ? "Diseñando Esquemas con Gemini..." : "Generar Esquema de Base de Datos Personalizado"}
              </button>

              {aiError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-mono">
                  Error: {aiError}
                </div>
              )}

              {generatedCode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Esquema AI Generado con Éxito</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-slate-300 bg-slate-950 p-4 rounded-lg overflow-y-auto max-h-[250px] border border-slate-800 whitespace-pre-wrap leading-relaxed">
                    {generatedCode}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
