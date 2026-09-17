import React, { useState } from "react";
import { PortalConfig } from "../types";
import { ShieldCheck, UserCheck, CreditCard, Award, Calendar, AlertTriangle, Users, BookOpen, Clock, Activity, Settings, Bell, CheckCircle, FileText } from "lucide-react";

const PORTALS_METADATA: Record<string, PortalConfig> = {
  admin: {
    id: "admin",
    title: "Portal Administrativo / Secretaría",
    subtitle: "Consola gerencial de mando del SIS",
    audience: "Personal administrativo, Rectores y Jefes de Admisiones",
    features: [
      "Dashboard unificado con métricas clave de recaudación, asistencia escolar general y embudo de captación.",
      "Aprobación asíncrona de expedientes y convalidaciones oficiales.",
      "Auditoría inmutable de accesos y modificaciones en el libro de notas.",
      "Configurador del cierre masivo del ciclo lectivo y migración automática de datos."
    ],
    metrics: [
      { label: "Matrícula Activa Total", value: "1,248 alumnos", trend: "+5.4%", color: "indigo" },
      { label: "Tasa de Asistencia General", value: "94.2%", trend: "Estable", color: "emerald" },
      { label: "Recaudación de Pensiones", value: "$184,200", trend: "82.4% de meta", color: "sky" },
      { label: "Firma de Contratos", value: "48 pendientes", trend: "Urgente", color: "rose" }
    ]
  },
  teacher: {
    id: "teacher",
    title: "Portal del Personal Docente",
    subtitle: "Control académico del aula integrada",
    audience: "Profesores, tutores de nivel y coordinadores pedagógicos",
    features: [
      "Pase de lista diario por materia con tabla interactiva y detección precoz de ausencias reiteradas.",
      "Cargador ágil de calificaciones con ponderaciones automáticas y actas de notas digitales.",
      "Agenda de clases sincronizada con el distributivo académico centralizado (Master Schedule).",
      "Bitácora disciplinaria y canal directo de comunicación con representantes."
    ],
    metrics: [
      { label: "Clases Impartidas Hoy", value: "4 períodos", trend: "Completado", color: "emerald" },
      { label: "Alumnos a Cargo", value: "140 estudiantes", trend: "Distribuidos", color: "indigo" },
      { label: "Promedio de Curso", value: "8.4 / 10", trend: "Rendimiento óptimo", color: "sky" },
      { label: "Alertas Deserción", value: "2 alumnos en riesgo", trend: "Twilio SMS enviado", color: "rose" }
    ]
  },
  student_parent: {
    id: "student_parent",
    title: "Portal de Estudiantes y Representantes",
    subtitle: "Transparencia escolar en tiempo real",
    audience: "Estudiantes matriculados y sus padres o tutores legales",
    features: [
      "Consulta inmediata del boletín de notas acumulado y boletas parciales.",
      "Asistómetro interactivo con detalle de justificaciones pendientes y atrasos.",
      "Visualizador del estado de cuenta de pensiones con pasarela de pago digital Stripe.",
      "Agendamiento simplificado de tutorías psicopedagógicas con tutores de curso."
    ],
    metrics: [
      { label: "Boleta de Notas Activa", value: "9.1 / 10", trend: "Promedio excelente", color: "emerald" },
      { label: "Inasistencias Registradas", value: "3 faltas", trend: "8% del límite", color: "yellow" },
      { label: "Pensiones por Pagar", value: "1 pendiente", trend: "Vence en 8 días", color: "rose" },
      { label: "Tutorías Programadas", value: "1 este Viernes", trend: "Orientación", color: "indigo" }
    ]
  }
};

export default function PortalPreviews() {
  const [activePortalId, setActivePortalId] = useState<string>("admin");
  const portal = PORTALS_METADATA[activePortalId];

  // Simulated state for interactive student list in Teacher Portal
  const [students, setStudents] = useState([
    { id: "EST-401", name: "Sofía Martínez", status: "PRESENTE", phone: "+34 600 111 222", consecutiveAbsences: 0 },
    { id: "EST-402", name: "Mateo Valenzuela", status: "PRESENTE", phone: "+34 600 222 333", consecutiveAbsences: 1 },
    { id: "EST-403", name: "Catalina Espinoza", status: "AUSENTE", phone: "+34 600 333 444", consecutiveAbsences: 4 }, // High risk!
    { id: "EST-404", name: "Tomás Alarcón", status: "PRESENTE", phone: "+34 600 444 555", consecutiveAbsences: 0 }
  ]);

  const [alertSentId, setAlertSentId] = useState<string | null>(null);

  const toggleStudentStatus = (id: string) => {
    setStudents(prev => prev.map(stud => {
      if (stud.id === id) {
        const nextStatus = stud.status === "PRESENTE" ? "AUSENTE" : "PRESENTE";
        const nextAbsences = nextStatus === "AUSENTE" ? stud.consecutiveAbsences + 1 : 0;
        return { ...stud, status: nextStatus, consecutiveAbsences: nextAbsences };
      }
      return stud;
    }));
  };

  const triggerSMSAlert = (id: string, name: string, phone: string, count: number) => {
    setAlertSentId(id);
    // Simulate API alert dispatch
    setTimeout(() => {
      setAlertSentId(null);
      alert(`[SMS Gateway Twilio] Alerta despachada con éxito al representante de ${name} (${phone}). Mensaje: Estudiante presenta ausencias reiteradas sin justificar.`);
    }, 1200);
  };

  return (
    <div id="portal-previews" className="flex flex-col gap-5 h-full">
      {/* Top Selector Tab Bar */}
      <div className="flex gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 max-w-xl self-center w-full">
        <button
          onClick={() => setActivePortalId("admin")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 ${
            activePortalId === "admin"
              ? "bg-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Administración
        </button>
        <button
          onClick={() => setActivePortalId("teacher")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 ${
            activePortalId === "teacher"
              ? "bg-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Portal Docente
        </button>
        <button
          onClick={() => setActivePortalId("student_parent")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 ${
            activePortalId === "student_parent"
              ? "bg-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          Estudiantes / Padres
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: General portal details and requirements */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Vista de Rol Escolar</span>
              <h3 className="text-lg font-bold text-white mt-1">{portal.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{portal.subtitle}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Audiencia del Portal</span>
              <p className="text-xs text-slate-300 bg-slate-950/65 px-3 py-1.5 rounded-lg border border-slate-850">
                {portal.audience}
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-800 pt-3">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Características Core</span>
              <ul className="space-y-1.5">
                {portal.features.map((feat, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 mt-4 flex items-center gap-2.5">
            <Activity className="w-9 h-9 text-indigo-400 shrink-0" />
            <p className="text-[10px] text-slate-400 leading-normal">
              Esta interfaz aprovecha protocolos <strong>PWA (Progressive Web App)</strong> para despachar notificaciones Push y funcionar de manera fuera de línea (offline-first).
            </p>
          </div>
        </div>

        {/* Right Side: Rendered Dashboard Preview */}
        <div className="lg:col-span-8 bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
          
          {/* Mock Window Browser Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-mono text-slate-500 ml-2">https://school-erp.cloud/portal/{portal.id}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full font-bold text-slate-300">ACTIVO</span>
            </div>
          </div>

          {/* Render Dashboard Metrics based on active role */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
            {portal.metrics.map(m => (
              <div key={m.label} className="bg-slate-900 border border-slate-850 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[9px] text-slate-400 font-bold block leading-tight">{m.label}</span>
                <span className="text-sm font-black text-slate-200 mt-1">{m.value}</span>
                <span className="text-[9px] text-indigo-300 mt-0.5 font-semibold block">{m.trend}</span>
              </div>
            ))}
          </div>

          {/* Interactive Portal Area (Specific components) */}
          <div className="flex-1 min-h-[220px] bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            {activePortalId === "admin" && (
              <div className="space-y-3 h-full flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-400" />
                    Consola de Cierre de Ciclo e Índices Escolares
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Sincronización en la nube con las dependencias oficiales ministeriales de titulación electrónica.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-850">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                      Emisión de Certificaciones
                    </span>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Generar Boleta de Promoción</span>
                      <button className="px-2 py-1 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-bold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer">
                        Ejecutar PDF
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-850">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                      Mantenimiento de Seguridad
                    </span>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Auditar Cambios de Notas</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded">
                        Cumplido GDPR
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-slate-500 italic text-center">
                  * Secretaría general cuenta con permisos totales sobre expedientes y distributivo de horarios.
                </div>
              </div>
            )}

            {activePortalId === "teacher" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      Pase de Lista: 5to Grado Primaria (Cátedra de Programación)
                    </h4>
                    <p className="text-[10px] text-slate-400">Presiona sobre el estatus de un alumno para alternar asistencia en tiempo real.</p>
                  </div>
                  <span className="text-[10px] text-indigo-300 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">10:00 - 11:30</span>
                </div>

                {/* Interactive Students List inside Teacher view */}
                <div className="space-y-1.5">
                  {students.map(stud => (
                    <div key={stud.id} className="p-2 bg-slate-950/50 rounded-lg border border-slate-850/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500 text-[10px]">{stud.id}</span>
                        <span className="font-bold text-slate-300">{stud.name}</span>
                        {stud.consecutiveAbsences >= 3 && (
                          <span className="inline-flex items-center gap-0.5 px-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-bold rounded">
                            <AlertTriangle className="w-2.5 h-2.5" /> {stud.consecutiveAbsences} faltas continuas (Riesgo Deserción)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleStudentStatus(stud.id)}
                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold cursor-pointer transition-colors ${
                            stud.status === "PRESENTE"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {stud.status}
                        </button>

                        {stud.consecutiveAbsences >= 3 && (
                          <button
                            onClick={() => triggerSMSAlert(stud.id, stud.name, stud.phone, stud.consecutiveAbsences)}
                            disabled={alertSentId === stud.id}
                            className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            {alertSentId === stud.id ? "Enviando..." : "Alerta SMS"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activePortalId === "student_parent" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    Expediente Académico de Lucas Martínez
                  </h4>
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-850 font-mono text-slate-400">Año 2026</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Ledger summary */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Boletín de Notas</span>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Matemáticas Avanzadas:</span>
                        <strong className="text-slate-200">9.5 / 10</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Introducción al Software:</span>
                        <strong className="text-slate-200">9.0 / 10</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Historia & Sociedad:</span>
                        <strong className="text-slate-200">8.8 / 10</strong>
                      </div>
                    </div>
                  </div>

                  {/* Payment checkout simulation */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
                        Pensiones Pendientes
                      </span>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-400">Mensualidad Marzo:</span>
                        <strong className="text-slate-200">$250.00</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => alert("[Pago Recibido] Sincronizando con ERP Financiero... Generando factura fiscal en QuickBooks.")}
                      className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <CreditCard className="w-3 h-3" /> Pagar Colegiatura con Stripe
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
