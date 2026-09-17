import React, { useState } from "react";
import { Server, Users, Database, Globe, Network, ShieldCheck, Mail, CreditCard, PenTool, MessageSquare, AlertTriangle, Layers } from "lucide-react";

interface NodeDetails {
  title: string;
  category: "Client" | "SIS Core" | "Data" | "External Integration";
  description: string;
  protocols: string;
  dataFlow: string;
  security: string;
  lmsPayload?: string;
}

const ARCHITECTURE_NODES: Record<string, NodeDetails> = {
  portals: {
    title: "Portales de Usuario (PWA / Web App)",
    category: "Client",
    description: "Interfaces responsivas construidas sobre arquitecturas SPA/PWA que consumen la API de forma reactiva.",
    protocols: "HTTPS, WebSocket (para notificaciones en tiempo real)",
    dataFlow: "Envía datos de formularios, consultas y acciones. Recibe estados de cuenta, boletas, alertas y distributivos.",
    security: "Autenticación basada en JWT, HTTPS TLS 1.3, Cookies HTTP-Only.",
  },
  api_gateway: {
    title: "API Gateway & RBAC Security Layer",
    category: "SIS Core",
    description: "Punto de entrada único regulado por políticas de control de acceso basado en roles (RBAC). Orquesta, rate-limita y audita todas las transacciones.",
    protocols: "RESTful, GraphQL, OAuth 2.0 (Bearer Token)",
    dataFlow: "Enruta peticiones de clientes hacia microservicios o controladores internos. Aplica middleware de validación e inyección de contexto de usuario.",
    security: "Rate Limiting, CORS, OWASP Top 10 Protections, JWT Verification.",
  },
  core_sis: {
    title: "Motor de Lógica Core (SIS / ERP Académico)",
    category: "SIS Core",
    description: "Servicios modulares que controlan expedientes académicos, asignación de distributivos de horarios sin solapamiento, libro de calificaciones con promedios ponderados y automatrículas.",
    protocols: "Internal gRPC / Services, Node.js Engine",
    dataFlow: "Consulta y escribe datos estructurados de alumnos y finanzas. Despacha eventos asíncronos a colas de mensajería.",
    security: "Validación estricta de esquemas (Zod), cifrado de datos sensibles en reposo.",
  },
  db_postgres: {
    title: "Base de Datos Relacional (PostgreSQL)",
    category: "Data",
    description: "Almacenamiento persistente, robusto y altamente relacional de expedientes, matrículas, notas, distributivos de profesores, calendarios financieros y auditorías de cambios.",
    protocols: "PostgreSQL Connection Protocol (Drizzle ORM)",
    dataFlow: "Estructura en tablas con integridad referencial fuerte, llaves primarias/foráneas, índices en student_id y period_id, y disparadores automáticos.",
    security: "Cifrado de base de datos AES-256, políticas de seguridad a nivel de fila (RLS), copias de seguridad incrementales automatizadas.",
  },
  lms_sync: {
    title: "Conector LMS Bidireccional",
    category: "External Integration",
    description: "Sincronizador inteligente nativo con entornos virtuales (LMS) externos como Canvas, Google Classroom y Moodle. Sincroniza clases, estudiantes, tareas y actas de notas.",
    protocols: "LTI 1.3 (Learning Tools Interoperability), OAuth2 Client Credentials, REST Webhooks",
    dataFlow: "Envía listas de alumnos y horarios de clases. Recupera calificaciones ponderadas y estados de entrega de asignaciones.",
    security: "Firma RSA-SHA256, Intercambio seguro de llaves JWKS.",
    lmsPayload: `{
  "lms_provider": "Canvas LMS",
  "sync_event": "GRADING_BOOK_IMPORT",
  "course_id": "LMS_CS_101",
  "assignments": [
    {
      "lms_assignment_id": "canvas-task-9021",
      "title": "Evaluación Parcial de Programación",
      "max_points": 10.0,
      "grades": [
        { "student_lms_id": "canvas-stud-411", "score": 9.5 },
        { "student_lms_id": "canvas-stud-412", "score": 8.0 }
      ]
    }
  ]
}`
  },
  finance_erp: {
    title: "ERP Contable y Pasarelas de Pago",
    category: "External Integration",
    description: "Sincronizador financiero externo (QuickBooks, SAP) y motores de recaudo digital (Stripe, PayPal, bancos locales). Automatiza conciliaciones de mora, becas y planes de pago.",
    protocols: "RESTful JSON, Webhooks cifrados",
    dataFlow: "Exporta libros de ventas, facturas emitidas y devengos. Importa estados de pago exitosos para levantar bloqueos académicos.",
    security: "Firma criptográfica de webhooks, Tokens de sesión PCI-DSS compliant.",
  },
  signature_sms: {
    title: "Firma Digital & Notificaciones SMS",
    category: "External Integration",
    description: "Pasarelas electrónicas de legalización contractual (matrícula formal en línea) y servicios SMS/Notificaciones Masivas (Twilio) para alertas preventivas de deserción escolar.",
    protocols: "REST API, SMTP",
    dataFlow: "Envía contratos en PDF y números celulares. Recibe el hash de firma verificado y confirmaciones de entrega de SMS.",
    security: "Cifrado de contratos (SHA-256), validación de firmas OTP.",
  }
};

export default function ArchitectureVisualizer() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("api_gateway");
  const selectedNode = ARCHITECTURE_NODES[selectedNodeId];

  return (
    <div id="architecture-visualizer" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Dynamic Interactive Diagram Panel */}
      <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4 z-10">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-400 animate-pulse" />
              Plano de Arquitectura de Integración (API-First)
            </h3>
            <p className="text-xs text-slate-400">
              Haz clic sobre cualquier componente para explorar su flujo de datos, protocolos y especificaciones de seguridad.
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full">
            REST & OAuth2 Architecture
          </span>
        </div>

        {/* Visual Architectural Canvas using rich interactive layout */}
        <div className="flex-1 min-h-[380px] relative flex flex-col items-center justify-center p-4 bg-slate-950/40 rounded-lg border border-slate-800/40">
          
          {/* Layer 1: Clients */}
          <div className="w-full flex justify-center mb-8">
            <button
              onClick={() => setSelectedNodeId("portals")}
              className={`px-5 py-3 rounded-lg border flex items-center gap-3 transition-all duration-300 transform hover:-translate-y-0.5 ${
                selectedNodeId === "portals"
                  ? "bg-sky-500/20 border-sky-400 text-sky-200 shadow-[0_0_15px_rgba(14,165,233,0.15)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <Users className="w-5 h-5 text-sky-400" />
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-wider text-sky-400/80">Capa de Cliente</div>
                <div className="text-sm font-semibold">Portales (Docente, Admin, Padres)</div>
              </div>
            </button>
          </div>

          {/* Connectors Layer 1 to 2 */}
          <div className="w-0.5 h-6 bg-slate-700"></div>

          {/* Layer 2: API Gateway */}
          <div className="w-full flex justify-center mb-8">
            <button
              onClick={() => setSelectedNodeId("api_gateway")}
              className={`px-6 py-3 rounded-lg border flex items-center gap-3 transition-all duration-300 transform hover:-translate-y-0.5 ${
                selectedNodeId === "api_gateway"
                  ? "bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-400/80">API Gateway</div>
                <div className="text-sm font-semibold">REST API / RBAC Auth Layer</div>
              </div>
            </button>
          </div>

          {/* Connectors Layout Split */}
          <div className="w-full max-w-md flex justify-between px-10 relative">
            <div className="absolute left-1/2 top-0 w-0.5 h-8 bg-slate-700 -translate-x-1/2"></div>
            <div className="absolute left-10 right-10 top-0 h-0.5 bg-slate-700"></div>
            <div className="w-0.5 h-8 bg-slate-700"></div>
            <div className="w-0.5 h-8 bg-slate-700"></div>
            <div className="w-0.5 h-8 bg-slate-700"></div>
          </div>

          {/* Layer 3: SIS CORE & CONNECTORS */}
          <div className="w-full grid grid-cols-3 gap-4 mb-8">
            {/* Left Connectors: Finance */}
            <button
              onClick={() => setSelectedNodeId("finance_erp")}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all duration-300 ${
                selectedNodeId === "finance_erp"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <CreditCard className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="text-xs font-bold block">ERP Financiero</span>
              <span className="text-[10px] text-slate-400">Pasarelas & Bancos</span>
            </button>

            {/* Middle Node: CORE SIS */}
            <button
              onClick={() => setSelectedNodeId("core_sis")}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all duration-300 ${
                selectedNodeId === "core_sis"
                  ? "bg-purple-500/20 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <Server className="w-5 h-5 text-purple-400 mb-1 animate-pulse" />
              <span className="text-xs font-bold block">Core SIS Engine</span>
              <span className="text-[10px] text-slate-400">Lógica de Horarios/Plan</span>
            </button>

            {/* Right Node: LMS Sincronizadores */}
            <button
              onClick={() => setSelectedNodeId("lms_sync")}
              className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all duration-300 ${
                selectedNodeId === "lms_sync"
                  ? "bg-orange-500/20 border-orange-400 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.15)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <Globe className="w-5 h-5 text-orange-400 mb-1" />
              <span className="text-xs font-bold block">Conectores LMS</span>
              <span className="text-[10px] text-slate-400">Canvas / Google Classroom</span>
            </button>
          </div>

          {/* Connectors Layout Downwards */}
          <div className="w-full max-w-xs flex justify-between px-16 relative">
            <div className="absolute left-1/2 top-0 w-0.5 h-6 bg-slate-700 -translate-x-1/2"></div>
            <div className="absolute left-16 right-16 top-0 h-0.5 bg-slate-700"></div>
            <div className="w-0.5 h-6 bg-slate-700"></div>
            <div className="w-0.5 h-6 bg-slate-700"></div>
          </div>

          {/* Layer 4: PERSISTENCE & AUX INTEGRATIONS */}
          <div className="w-full grid grid-cols-2 gap-6 max-w-md">
            {/* Persistence: DB Postgres */}
            <button
              onClick={() => setSelectedNodeId("db_postgres")}
              className={`p-3 rounded-lg border flex items-center justify-center gap-3 transition-all duration-300 ${
                selectedNodeId === "db_postgres"
                  ? "bg-blue-500/20 border-blue-400 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <Database className="w-5 h-5 text-blue-400" />
              <div className="text-left">
                <span className="text-xs font-bold block">PostgreSQL (Drizzle)</span>
                <span className="text-[10px] text-slate-400">Esquemas Relacionales</span>
              </div>
            </button>

            {/* Signature & SMS Notifications */}
            <button
              onClick={() => setSelectedNodeId("signature_sms")}
              className={`p-3 rounded-lg border flex items-center justify-center gap-3 transition-all duration-300 ${
                selectedNodeId === "signature_sms"
                  ? "bg-pink-500/20 border-pink-400 text-pink-200 shadow-[0_0_15px_rgba(236,72,153,0.15)]"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <PenTool className="w-5 h-5 text-pink-400" />
              <div className="text-left">
                <span className="text-xs font-bold block">Firma & SMS</span>
                <span className="text-[10px] text-slate-400">Twilio & Legalización</span>
              </div>
            </button>
          </div>

        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-slate-400 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-sky-500/20 border border-sky-400 rounded-sm"></span>
            <span>Interfaces</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-indigo-500/20 border border-indigo-400 rounded-sm"></span>
            <span>Seguridad & Orquestación</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-purple-500/20 border border-purple-400 rounded-sm"></span>
            <span>Lógica SIS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-500/20 border border-blue-400 rounded-sm"></span>
            <span>Bases de Datos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-orange-500/20 border border-orange-400 rounded-sm"></span>
            <span>Integraciones Externas</span>
          </div>
        </div>
      </div>

      {/* Side Details Information Panel */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${
                selectedNode.category === "Client" ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" :
                selectedNode.category === "SIS Core" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                selectedNode.category === "Data" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                "bg-orange-500/10 text-orange-400 border border-orange-500/20"
              }`}>
                {selectedNode.category}
              </span>
              <span className="text-slate-500 text-xs font-mono">ID: {selectedNodeId}</span>
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-2">{selectedNode.title}</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">{selectedNode.description}</p>

            <div className="space-y-3.5 border-t border-slate-800 pt-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  Protocolos & Estándares
                </span>
                <span className="text-xs text-slate-300 font-mono block bg-slate-950/60 p-2 rounded border border-slate-800/40">
                  {selectedNode.protocols}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  Flujo y Datos de Intercambio
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedNode.dataFlow}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  Estrategia de Seguridad
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  {selectedNode.security}
                </span>
              </div>
            </div>
          </div>

          {/* Show a mini JSON payload snippet for LMS/API sync node */}
          {selectedNode.lmsPayload && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block mb-1">
                Ejemplo Payload de Sincronización LMS
              </span>
              <pre className="text-[10px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded overflow-x-auto max-h-[120px] border border-slate-800">
                {selectedNode.lmsPayload}
              </pre>
            </div>
          )}
        </div>

        {/* Integration Sequence Summary Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <Layers className="w-10 h-10 text-indigo-400 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-slate-200">Enfoque API-First Consolidado</h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              Esta topología centraliza la vida escolar y garantiza que cualquier software de contabilidad local o LMS externo mantenga una copia idéntica y oportuna del ciclo escolar en tiempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
