import React, { useState } from "react";
import { ModuleInfo } from "../types";
import { UserCheck, FolderHeart, Calendar, Award, AlertCircle, Shield, CreditCard, ClipboardCheck, Settings, Cpu, Copy, Check, Info } from "lucide-react";

const SYSTEM_MODULES: ModuleInfo[] = [
  {
    id: "crm",
    title: "1. CRM de Admisiones y Captación",
    icon: "UserCheck",
    description: "Gestión del embudo de ventas y admisión escolar, desde el registro inicial del aspirante, solicitudes en línea y auto-matriculación, hasta la firma digital del contrato educativo.",
    detailedFeatures: [
      "Embudo de conversión visual (Prospecto -> Aspirante -> Evaluado -> Admitido -> Matriculado).",
      "Formularios de solicitud en línea y carga digital de documentos académicos históricos.",
      "Motor de admisiones con asignación de citas para exámenes y entrevistas psicológicas.",
      "Generación de contratos digitales integrados con firmas OTP/SMS para legalización en línea."
    ],
    integrationFlow: "Prospecto se registra -> Valida documentos de forma asíncrona -> Envía webhook a pasarela de firma digital -> Se genera id de estudiante al completarse la firma.",
    dbEntities: ["estudiantes", "matriculas"],
    restEndpoints: ["POST /api/v1/enrollments"]
  },
  {
    id: "expedientes",
    title: "2. Expedientes y Registro Escolar",
    icon: "FolderHeart",
    description: "Expediente digital 'vivo' del estudiante. Controla la malla curricular, planes de estudio estructurados por materia, grado o nivel, equivalencias y constancias oficiales.",
    detailedFeatures: [
      "Expediente digitalizado único con datos de salud, antecedentes familiares y ficha pedagógica.",
      "Configurador de malla curricular flexible para educación K-12, técnica y superior.",
      "Control de prerrequisitos de asignaturas, convalidaciones y homologaciones automáticas.",
      "Módulo de certificaciones y emisión de constancias de inscripción inmediatas."
    ],
    integrationFlow: "Admisión finalizada -> Creación de expediente -> Inscripción automática en malla curricular según nivel -> Generación de boleta de inscripción oficial.",
    dbEntities: ["estudiantes", "matriculas"],
    restEndpoints: ["GET /api/v1/students/search"]
  },
  {
    id: "distributivo",
    title: "3. Distributivo Académico y Horarios",
    icon: "Calendar",
    description: "Motor de asignación de carga horaria semanal (Master Schedule Builder). Empareja profesores, materias, aulas y cursos sin solapamientos, vigilando los topes laborales.",
    detailedFeatures: [
      "Algoritmo de asignación de horarios sin conflictos (profesor-hora, aula-hora, curso-hora).",
      "Control de distributivo de trabajo docente y seguimiento de horas laborables asignadas.",
      "Planificación de sustituciones temporales y alertas de sobrecarga horaria.",
      "Historial de desempeño y currículum vitae del personal académico."
    ],
    integrationFlow: "Ingreso de carga por materia -> Algoritmo de validación espacial y horaria -> Generación de horarios individuales para docentes y alumnos.",
    dbEntities: ["profesores", "carga_horaria"],
    restEndpoints: ["POST /api/v1/distributive/assign"]
  },
  {
    id: "evaluacion",
    title: "4. Evaluación, Libro de Calificaciones y Portafolio Docente",
    icon: "Award",
    description: "Libro de calificaciones digital con actas digitales, cálculo automático de medias ponderadas y portafolio interactivo para que los docentes compartan recursos académicos.",
    detailedFeatures: [
      "Configuración paramétrica de evaluaciones (exámenes parciales, deberes, trabajos cooperativos).",
      "Cálculo automático de promedios o medias ponderadas con redondeo regulado por el ministerio.",
      "Portafolio digital docente para subir recursos de clase, guías de estudio y rúbricas.",
      "Generación y cierre digital de actas de notas con firma biométrica del docente."
    ],
    integrationFlow: "Profesor califica tarea en LMS (Canvas/Classroom) -> Webhook de notas recibido -> Actualización en tiempo real del libro de calificaciones en el SIS.",
    dbEntities: ["calificaciones", "carga_horaria"],
    restEndpoints: ["POST /api/v1/lms/sync"]
  },
  {
    id: "asistencia",
    title: "5. Asistencia e Incidencias en Tiempo Real",
    icon: "AlertCircle",
    description: "Registro de control diario de ausencias por materia. Incluye alertas inmediatas a padres ante ausencias consecutivas para prevenir la deserción escolar precoz.",
    detailedFeatures: [
      "Pase de lista digital con soporte para tabla de asientos física interactiva.",
      "Algoritmo de detección de patrones de inasistencia reiterada (prevención de abandono escolar).",
      "Despacho automático de notificaciones SMS y push a representantes de forma inmediata.",
      "Registro de justificaciones médicas con cargador de archivos de soporte."
    ],
    integrationFlow: "Docente pasa lista -> Estudiante marcado Ausente -> Se dispara SMS masivo vía Twilio API -> Alerta de riesgo de deserción en panel administrativo.",
    dbEntities: ["asistencias", "carga_horaria"],
    restEndpoints: ["POST /api/v1/attendance/alert"]
  },
  {
    id: "disciplina",
    title: "6. Módulo Disciplinario, Tutorías y Evaluación",
    icon: "Shield",
    description: "Registro de incidencias de conducta, gestión y agendamiento de tutorías psicopedagógicas, y evaluaciones institucionales del desempeño de los profesores.",
    detailedFeatures: [
      "Bitácora de comportamiento digital y seguimiento de incidencias con notificación a familias.",
      "Agendamiento y control de tutorías de orientación estudiantil y planes de apoyo pedagógico.",
      "Encuestas de satisfacción institucionales y co-evaluaciones del personal docente.",
      "Generación de reportes de clima escolar y estadísticas de bienestar estudiantil."
    ],
    integrationFlow: "Incidencia disciplinaria crítica -> Alerta automática al departamento de psicología -> Agendamiento de tutoría familiar -> Registro en expediente vivo.",
    dbEntities: ["asistencias", "estudiantes"],
    restEndpoints: ["POST /api/v1/discipline/incident"]
  },
  {
    id: "finanzas",
    title: "7. Módulo Financiero, Pagos y Gestión de Becas",
    icon: "CreditCard",
    description: "Calendarios de pagos, facturación recurrente de colegiaturas, control de cartera vencida, y gestión de descuentos vinculados a becas estudiantiles con análisis de retención.",
    detailedFeatures: [
      "Generación automatizada de cuentas por cobrar recurrentes basadas en planes de estudio.",
      "Control de mora, recargos automáticos y pasarela de conciliación bancaria digital.",
      "Administración del presupuesto de becas institucionales e incentivos de retención.",
      "Estado de cuenta en tiempo real para representantes con enlace seguro de pago digital (Stripe/banco)."
    ],
    integrationFlow: "Inicio de mes -> Emisión masiva de facturas -> Sincronización QuickBooks -> Representante paga por Stripe -> Registro automático del ingreso contable.",
    dbEntities: ["facturas", "estudiantes"],
    restEndpoints: ["POST /api/v1/finance/invoice"]
  },
  {
    id: "certificacion",
    title: "8. Documentación Oficial, Cuadro de Honor y Titulación",
    icon: "ClipboardCheck",
    description: "Emisión instantánea de boletas de notas, actas, certificados de promoción y generación de títulos electrónicos con códigos QR de validación gubernamental.",
    detailedFeatures: [
      "Algoritmo para cálculo automático de Cuadros de Honor y Top 10 alumnos de rendimiento.",
      "Generación masiva de boletas de calificaciones oficiales listas para imprimir o enviar.",
      "Emisión de Títulos y Certificados Electrónicos con firma digital calificada y código QR.",
      "Módulo de reportería agregada de rendimiento académico para directores de área."
    ],
    integrationFlow: "Aprobación de ciclo -> Cálculo automático de promedios de promoción -> Firma digital del Rector en PDF -> Registro QR público para validación ministerial.",
    dbEntities: ["documentos_oficiales", "estudiantes"],
    restEndpoints: ["GET /api/v1/reports/honors"]
  },
  {
    id: "mantenimiento",
    title: "9. Seguridad RBAC y Cierre de Ciclo Lectivo",
    icon: "Settings",
    description: "Control de accesos basado en roles (RBAC) con auditoría estricta y proceso automatizado de Cierre de Año Lectivo: migración, reindexación y respaldos de seguridad.",
    detailedFeatures: [
      "Consola de asignación de roles jerárquicos (Administrador, Docente, Estudiante, Tutor, Auditor).",
      "Auditoría detallada de cambios en registros y calificaciones (cumplimiento GDPR / leyes locales).",
      "Asistente automatizado de cierre de ciclo: promoción masiva de estudiantes al siguiente nivel.",
      "Respaldo automático de base de datos en nube fría y reindexación de tablas históricas."
    ],
    integrationFlow: "Fin de año -> Cierre de libro de notas -> Promoción masiva al grado N+1 -> Bloqueo histórico del periodo concluido -> Respaldo de seguridad.",
    dbEntities: ["estudiantes", "matriculas", "calificaciones"],
    restEndpoints: ["POST /api/v1/system/close-cycle"]
  }
];

export default function ModuleBlueprint() {
  const [selectedModuleId, setSelectedModuleId] = useState<string>("crm");
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const activeModule = SYSTEM_MODULES.find(m => m.id === selectedModuleId) || SYSTEM_MODULES[0];

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case "UserCheck": return <UserCheck className="w-4 h-4" />;
      case "FolderHeart": return <FolderHeart className="w-4 h-4" />;
      case "Calendar": return <Calendar className="w-4 h-4" />;
      case "Award": return <Award className="w-4 h-4" />;
      case "AlertCircle": return <AlertCircle className="w-4 h-4" />;
      case "Shield": return <Shield className="w-4 h-4" />;
      case "CreditCard": return <CreditCard className="w-4 h-4" />;
      case "ClipboardCheck": return <ClipboardCheck className="w-4 h-4" />;
      case "Settings": return <Settings className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const handleGenerateController = async (controllerType: string) => {
    setGenerating(true);
    setAiError("");
    setGeneratedCode("");
    try {
      const response = await fetch("/api/ai/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: activeModule.title, type: controllerType }),
      });
      const data = await response.json();
      if (data.error) {
        setAiError(data.error);
      } else {
        setGeneratedCode(data.code);
      }
    } catch (err: any) {
      setAiError(err.message || "Error al generar el controlador.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div id="module-blueprint" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Module Selector Sidebar */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          Módulos Core SIS / ERP
        </h3>
        <div className="space-y-1.5 overflow-y-auto max-h-[460px] pr-1">
          {SYSTEM_MODULES.map(mod => {
            const isSelected = mod.id === selectedModuleId;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  setSelectedModuleId(mod.id);
                  setGeneratedCode("");
                  setAiError("");
                }}
                className={`w-full text-left p-3 rounded-lg text-xs font-semibold border flex items-center gap-3 transition-all duration-200 ${
                  isSelected
                    ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.05)]"
                    : "bg-slate-950/20 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className={`p-1.5 rounded-md ${isSelected ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-900 text-slate-500"}`}>
                  {getModuleIcon(mod.icon)}
                </div>
                <div className="overflow-hidden">
                  <span className="block truncate">{mod.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Blueprint Specification Panel */}
      <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="border-b border-slate-800 pb-4 mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">{getModuleIcon(activeModule.icon)}</span>
              Especificaciones de Diseño: {activeModule.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{activeModule.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Functional Requirements */}
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/60">
              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5 text-indigo-400" />
                Requisitos Funcionales
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {activeModule.detailedFeatures.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-indigo-500 font-bold shrink-0">•</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Design Sequence & Relationships */}
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/60 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  Flujo de Integración
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed italic mb-4">
                  "{activeModule.integrationFlow}"
                </p>
              </div>

              <div className="space-y-3.5 border-t border-slate-800/60 pt-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Entidades SQL vinculadas:</span>
                  <div className="flex gap-1.5">
                    {activeModule.dbEntities.map(ent => (
                      <span key={ent} className="font-mono text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px]">
                        {ent}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Endpoints API asociados:</span>
                  <div className="flex gap-1.5">
                    {activeModule.restEndpoints.map(end => (
                      <span key={end} className="font-mono text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px]">
                        {end}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Code generation for controllers */}
          <div className="border-t border-slate-800 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Generación Inteligente de Controladores</h4>
                <p className="text-[10px] text-slate-400">Genera código de backend completo usando la API de Gemini.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerateController("controller")}
                  disabled={generating}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer disabled:opacity-50"
                >
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  Generar Express Controller
                </button>
              </div>
            </div>

            {aiError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-mono">
                Error: {aiError}
              </div>
            )}

            {generating && (
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-850 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400">Gemini está analizando la lógica del módulo para estructurar un controlador robusto en TypeScript con Express y Drizzle...</span>
              </div>
            )}

            {generatedCode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Código de Integración AI Sugerido</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "¡Copiado!" : "Copiar Código"}
                  </button>
                </div>
                <pre className="text-xs font-mono text-slate-300 bg-slate-950 p-4 rounded-lg overflow-y-auto max-h-[220px] border border-slate-800 whitespace-pre-wrap leading-normal">
                  {generatedCode}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
