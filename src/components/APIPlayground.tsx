import React, { useState } from "react";
import { Globe, Send, Terminal, Key, ShieldCheck, FileJson, Layers, Clipboard, Check } from "lucide-react";
import { RESTEndpoint, SandboxLog } from "../types";

// Core REST integration endpoints mapping
const REST_ENDPOINTS: Record<string, RESTEndpoint> = {
  enrollment_crm: {
    method: "POST",
    path: "/api/v1/enrollments",
    description: "Procesa solicitudes en línea desde el CRM de admisiones, valida documentación requerida y dispara el contrato de matrícula formal mediante firma digital.",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer jwt_token_secret_xxxxx"
    },
    requestBody: JSON.stringify({
      studentName: "Lucas Altamirano Vega",
      dni: "1729482012",
      email: "lucas.alt@gmail.com",
      planId: "K12-PRIMARIA-5TO-A",
      parentPhone: "+34 612 345 678",
      parentEmail: "representante.lucas@gmail.com",
      checkRequirements: true
    }, null, 2),
    responseBody: ""
  },
  lms_sync: {
    method: "POST",
    path: "/api/v1/lms/sync",
    description: "Sincroniza el distributivo académico de aulas, asignaciones de tareas y calificaciones acumuladas de forma bidireccional con Canvas, Moodle o Google Classroom.",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer jwt_token_secret_xxxxx",
      "X-LMS-Provider": "Google-Classroom"
    },
    requestBody: JSON.stringify({
      lms: "Google Classroom",
      courseId: "MAT_CLASS_5TO",
      syncDirection: "BIDIRECTIONAL",
      syncGrades: true,
      syncStudents: true
    }, null, 2),
    responseBody: ""
  },
  attendance_alert: {
    method: "POST",
    path: "/api/v1/attendance/alert",
    description: "Alerta en tiempo real sobre inasistencias acumuladas y consecutivas para prevención del abandono escolar. Envía notificaciones masivas de forma automática.",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer jwt_token_secret_xxxxx"
    },
    requestBody: JSON.stringify({
      studentId: "EST-40192",
      absencesCount: 5,
      parentPhone: "+34 602 112 233",
      alertChannel: "SMS_AND_PUSH",
      consecutiveStreak: true
    }, null, 2),
    responseBody: ""
  },
  finance_invoice: {
    method: "POST",
    path: "/api/v1/finance/invoice",
    description: "Configura o genera un cobro recurrente para planes de colegiatura, integrando asientos con ERPs contables (QuickBooks) y pasarelas de pago de Stripe.",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer jwt_token_secret_xxxxx"
    },
    requestBody: JSON.stringify({
      studentId: "EST-90112",
      concept: "Colegiatura Mensual Obligatoria Marzo 2026",
      amount: 320.00,
      applyScholarship: true,
      scholarshipPercent: 20.00,
      dueDate: "2026-03-10",
      syncQuickbooks: true
    }, null, 2),
    responseBody: ""
  }
};

export default function APIPlayground() {
  const [selectedEndpointKey, setSelectedEndpointKey] = useState<string>("enrollment_crm");
  const [requestBodyJson, setRequestBodyJson] = useState<string>(REST_ENDPOINTS[selectedEndpointKey].requestBody || "{}");
  const [simResponse, setSimResponse] = useState<any>(null);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const endpoint = REST_ENDPOINTS[selectedEndpointKey];

  const handleEndpointSelect = (key: string) => {
    setSelectedEndpointKey(key);
    setRequestBodyJson(REST_ENDPOINTS[key].requestBody || "{}");
    setSimResponse(null);
    setSimLogs([]);
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setSimResponse(null);
    setSimLogs([]);

    try {
      let parsedBody = {};
      try {
        parsedBody = JSON.parse(requestBodyJson);
      } catch (e) {
        setSimLogs([`[ERROR] JSON de entrada inválido: No se puede deserializar.`]);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/sandbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: endpoint.path,
          method: endpoint.method,
          body: parsedBody,
          headers: endpoint.headers
        }),
      });

      const data = await res.json();
      setSimResponse(data.response);
      setSimLogs(data.logs);
    } catch (err: any) {
      setSimLogs([`[ERROR] Error crítico de red al conectar con el motor de simulación: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="api-playground" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Endpoints listing & parameters */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-indigo-400" />
            Endpoints de Integración Externa
          </h3>
          <div className="space-y-2">
            {Object.keys(REST_ENDPOINTS).map(key => {
              const ep = REST_ENDPOINTS[key];
              const isSelected = selectedEndpointKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleEndpointSelect(key)}
                  className={`w-full text-left p-3 rounded-lg border flex items-start gap-3 transition-all duration-200 ${
                    isSelected
                      ? "bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.05)]"
                      : "bg-slate-950/35 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md uppercase tracking-wide shrink-0">
                    {ep.method}
                  </span>
                  <div className="space-y-0.5 overflow-hidden">
                    <span className="text-xs font-mono font-bold text-slate-200 block truncate">{ep.path}</span>
                    <span className="text-[10px] text-slate-400 block line-clamp-1">{ep.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Endpoint details & Edit Body */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Parámetros del Endpoint</h4>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{endpoint.description}</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Headers Requeridos</span>
              <div className="bg-slate-950/60 border border-slate-800/80 p-2 rounded-lg text-[10px] font-mono text-slate-300 space-y-1">
                {Object.entries(endpoint.headers).map(([k, v]) => (
                  <div key={k} className="truncate">
                    <strong className="text-slate-500">{k}:</strong> {v}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Cuerpo de la Petición (Request JSON Body)</span>
                <span className="text-[10px] text-slate-500 font-mono">Editable</span>
              </div>
              <textarea
                value={requestBodyJson}
                onChange={(e) => setRequestBodyJson(e.target.value)}
                className="w-full h-[180px] bg-slate-950 font-mono text-xs text-slate-300 p-3 rounded-lg border border-slate-800 outline-none focus:border-indigo-500 leading-normal resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-indigo-300 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4 animate-bounce" />
            {loading ? "Ejecutando Simulación..." : "Enviar Petición de Prueba"}
          </button>
        </div>
      </div>

      {/* Simulator Response logs and outputs */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Logs terminal */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col h-[200px] justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Terminal de Integración (Logs de Servidor)
            </span>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1.5 pr-1 leading-normal">
            {simLogs.length === 0 ? (
              <span className="text-slate-500 block italic">Listo. Haz clic en "Enviar Petición de Prueba" para visualizar las interconexiones en tiempo real.</span>
            ) : (
              simLogs.map((log, idx) => (
                <div key={idx} className="border-l-2 border-indigo-500 pl-2">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* JSON Response output */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col justify-between">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2 shrink-0">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                Respuesta del Servidor (Response Payload)
              </span>
              {simResponse && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(simResponse, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                  {copied ? "Copiado" : "Copiar JSON"}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800/80 p-3 rounded-lg max-h-[280px]">
              {simResponse ? (
                <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
                  {JSON.stringify(simResponse, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                  Ninguna petición ejecutada todavía
                </div>
              )}
            </div>
          </div>

          {/* Secure flow guarantee card */}
          <div className="mt-4 p-3 bg-slate-950/40 rounded-lg border border-slate-800/80 flex items-center gap-3 shrink-0">
            <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <h5 className="text-[10px] font-bold text-slate-300">Auditoría y Seguridad de Interoperabilidad</h5>
              <p className="text-[9px] text-slate-400 leading-normal">
                Todas las llamadas de sincronización externa se registran con marcas de tiempo (ISO 8601) inmutables, encriptación SHA-256 de webhooks y validación OAuth2/JWT Bearer obligatoria para evitar filtraciones de datos del alumnado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
