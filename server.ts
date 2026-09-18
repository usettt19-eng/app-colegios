import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialize Gemini API client with safety checks
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please add it via Settings > Secrets.");
    }
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

import authRoutes from "./backend/routes/auth";
import pickupRoutes from "./backend/routes/pickup";
import webhooksRoutes from "./backend/routes/webhooks";
import studentsRoutes from "./backend/routes/students";
import studentRecordRoutes from "./backend/routes/studentRecord";
import profilesRoutes from "./backend/routes/profiles";
import academicsRoutes from "./backend/routes/academics";
import tenantsRoutes from "./backend/routes/tenants";
import hierarchyRoutes from "./backend/routes/hierarchy";
import systemRoutes from "./backend/routes/system";
import enrollmentRoutes from "./backend/routes/enrollments";
import attendanceRoutes from "./backend/routes/attendance";
import financeRoutes from "./backend/routes/finance";
import lmsRoutes from "./backend/routes/lms";
import assignmentsRoutes from "./backend/routes/assignments";
import bulletinsRoutes from "./backend/routes/bulletins";
import contractsRoutes from "./backend/routes/contracts";
import documentsRoutes from "./backend/routes/documents";
import staffDocumentsRoutes from "./backend/routes/staffDocuments";
import communicationsRoutes from "./backend/routes/communications";
import messagesRoutes from "./backend/routes/messages";
import gradeSettingsRoutes from "./backend/routes/gradeSettings";
import bulkImportRoutes from "./backend/routes/bulkImport";
import transportRoutes from "./backend/routes/transport";
import corporateRoutes from "./backend/routes/corporate";
import admissionsCrmRoutes from "./backend/routes/admissionsCrm";
import { startAutoReleaseJob } from "./backend/jobs/autoRelease";
import { startRecurringExpenseReminderJob } from "./backend/jobs/recurringExpenseReminders";

const app = express();
// 15mb: los documentos del expediente (cédulas escaneadas, contratos,
// cotizaciones en PDF) viajan como data URL base64 en el body JSON; el
// límite por defecto de Express (100kb) es demasiado chico incluso para
// fotos de perfil, y ahora que hay subida real de archivos a Storage
// (documentStorage.ts) hace falta espacio para PDFs de varias páginas.
app.use(express.json({ limit: "15mb" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/pickup", pickupRoutes);
app.use("/api/v1/webhooks", webhooksRoutes);
app.use("/api/v1/students", studentsRoutes);
app.use("/api/v1/student-record", studentRecordRoutes);
app.use("/api/v1/profiles", profilesRoutes);
app.use("/api/v1/academics", academicsRoutes);
app.use("/api/v1/tenants", tenantsRoutes);
app.use("/api/v1/hierarchy", hierarchyRoutes);
app.use("/api/v1/system", systemRoutes);
app.use("/api/v1/enrollments", enrollmentRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/finance", financeRoutes);
app.use("/api/v1/lms", lmsRoutes);
app.use("/api/v1/assignments", assignmentsRoutes);
app.use("/api/v1/bulletins", bulletinsRoutes);
app.use("/api/v1/contracts", contractsRoutes);
app.use("/api/v1/documents", documentsRoutes);
app.use("/api/v1/staff-documents", staffDocumentsRoutes);
app.use("/api/v1/communications", communicationsRoutes);
app.use("/api/v1/messages", messagesRoutes);
app.use("/api/v1/grade-settings", gradeSettingsRoutes);
app.use("/api/v1/bulk-import", bulkImportRoutes);
app.use("/api/v1/transport", transportRoutes);
app.use("/api/v1/corporate", corporateRoutes);
app.use("/api/v1/admissions-crm", admissionsCrmRoutes);

// Iniciar procesos en segundo plano
startAutoReleaseJob();
startRecurringExpenseReminderJob();

// API: Health status check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV || "development" });
});

// API: AI Architect Advisor
app.post("/api/ai/advisor", async (req, res) => {
  try {
    const { message, history } = req.body;
    const client = getGeminiClient();

    // Setup an expert software architecture prompt
    const systemPrompt = `Actúas como un Arquitecto Principal de Software y Diseñador de Productos EdTech experto en sistemas de información escolar (SIS) y ERP académicos.
El usuario te está haciendo una pregunta técnica sobre la arquitectura de software, interoperabilidad, LMS (Canvas, Moodle, Google Classroom), bases de datos, seguridad, cumplimiento de datos (como GDPR/FERPA), distributivos de horarios, control de asistencia o facturación recurrentes en el contexto del SIS.

Responde de manera estructurada, técnica y muy profesional, proporcionando detalles arquitectónicos prácticos, recomendaciones de bases de datos, código de ejemplo (Express, SQL, Drizzle) o diagramas en texto cuando corresponda. Mantén una redacción elegante y fluida en español.`;

    // Map conversation history safely
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const item of history) {
        contents.push({
          role: item.role === "user" ? "user" : "model",
          parts: [{ text: item.content }],
        });
      }
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    res.json({ answer: response.text });
  } catch (error: any) {
    console.error("AI Advisor Error:", error);
    res.status(500).json({ error: error.message || "Error al procesar la solicitud con Gemini API." });
  }
});

// API: AI Code / Schema Generator
app.post("/api/ai/generate-code", async (req, res) => {
  try {
    const { module, type } = req.body; // module e.g. "finance", "lms", type e.g. "sql", "migration", "controller"
    const client = getGeminiClient();

    const prompt = `Como Arquitecto Principal de Software EdTech, genera código de alta calidad para el módulo "${module}" de tipo "${type}".
Opciones:
- Si el tipo es "sql", proporciona el script SQL DDL (CREATE TABLE con llaves primarias, foráneas, índices, restricciones) estructurado para PostgreSQL.
- Si el tipo es "controller", proporciona un controlador de Express (TypeScript) completo y listo para producción, que maneje lógica real del módulo (con validaciones, manejo de errores y transacciones si aplica).
- Si el tipo es "migration", genera un script de migración estructurado o esquema de TypeScript usando Drizzle ORM.
- Si el tipo es "integration", genera el código TypeScript de integración con un servicio externo relevante (ej. pasarela de firma digital, webhook LMS Canvas/Google Classroom, API Twilio para alertas de asistencia, etc.).

Devuelve ÚNICAMENTE el código bien formateado en markdown con su bloque de sintaxis correspondiente, seguido de una breve explicación de 2-3 líneas sobre las decisiones de diseño adoptadas.`;

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    res.json({ code: response.text });
  } catch (error: any) {
    console.error("AI Code Gen Error:", error);
    res.status(500).json({ error: error.message || "Error al generar código." });
  }
});

// API: REST Endpoint sandbox simulation
// Users can interactively execute requests against SIS modules in a safe simulator
app.post("/api/sandbox/simulate", (req, res) => {
  const { path: routePath, method, body, headers } = req.body;
  const timestamp = new Date().toISOString();

  // Create a structured, simulation engine for school events
  let responseData: any = {};
  let logs: string[] = [];
  let status = 200;

  logs.push(`[${timestamp}] Solicitud ${method} recibida en endpoint ${routePath}`);

  // Route router simulators
  if (routePath.includes("/api/v1/enrollments")) {
    if (method === "POST") {
      const studentName = body.studentName || "Estudiante Solicitante";
      const planId = body.planId || "PLAN_2026_K12";
      const enrollmentId = "MAT-" + Math.floor(100000 + Math.random() * 900000);
      
      responseData = {
        success: true,
        message: "Matrícula procesada y registrada exitosamente.",
        enrollment: {
          id: enrollmentId,
          studentName,
          planId,
          status: "PENDING_SIGNATURE",
          createdAt: timestamp,
          requirementsChecked: {
            academicHistory: true,
            identityDoc: true,
            financialClearance: true
          }
        },
        signatureFlow: {
          provider: "DocuSign / Signaturit",
          contractUrl: `https://sign.sis-edu.com/contracts/${enrollmentId}`,
          status: "SENT",
          expiresAt: new Date(Date.now() + 86400000 * 3).toISOString() // 3 days
        }
      };

      logs.push(`[CRM Admisiones] Expediente verificado para ${studentName}. Requisitos de admisión OK.`);
      logs.push(`[Firma Digital] Contrato de matrícula generado con ID: ${enrollmentId}-CTR.`);
      logs.push(`[Firma Digital] Enviado correo de firma electrónica con vínculo de autocolegiación.`);
    } else {
      responseData = {
        success: true,
        enrollments: [
          { id: "MAT-294012", studentId: "EST-4019", plan: "K12-Primaria-5to", status: "ACTIVE" },
          { id: "MAT-940219", studentId: "EST-9011", plan: "Univ-IngSistemas-3er", status: "PENDING_SIGNATURE" }
        ]
      };
    }
  } 
  else if (routePath.includes("/api/v1/lms/sync")) {
    const lms = body.lms || "Google Classroom";
    const courseId = body.courseId || "CLASS_MAT_101";
    
    responseData = {
      success: true,
      lms,
      courseId,
      synchronizedAt: timestamp,
      recordsSynced: {
        students: 28,
        teachers: 1,
        assignments: 12,
        grades: 336
      },
      status: "SYNC_COMPLETED"
    };

    logs.push(`[LMS Connector] Inicializando protocolo OAuth2 con ${lms}...`);
    logs.push(`[LMS Connector] Sincronizando distributivo académico para la materia ${courseId}.`);
    logs.push(`[LMS Connector] Sincronización bidireccional exitosa: 28 estudiantes vinculados.`);
    logs.push(`[LMS Connector] Libro de calificaciones actualizado con actas remotas.`);
  } 
  else if (routePath.includes("/api/v1/attendance/alert")) {
    const studentId = body.studentId || "EST-9021";
    const absences = body.absencesCount || 4;
    const parentPhone = body.parentPhone || "+34 600 000 000";

    responseData = {
      success: true,
      studentId,
      alertTriggered: true,
      detectionPattern: "CRITICAL_ABSENCE_STREAK",
      parentNotified: {
        method: "SMS_AND_PUSH",
        recipient: parentPhone,
        message: "Alerta SIS: El estudiante presenta ausencias consecutivas sin justificar. Se requiere agendar tutoría.",
        smsServiceSid: "SMS-TWILIO-" + Math.floor(10000 + Math.random() * 90000),
        status: "DELIVERED"
      },
      riskLevel: "HIGH"
    };

    logs.push(`[Asistencia Realtime] Alerta: Patrón de ausencias reiteradas detectado para Estudiante ${studentId}.`);
    logs.push(`[SMS Gateway] Conectando con Twilio API masivo...`);
    logs.push(`[SMS Gateway] Notificación enviada al representante en el teléfono: ${parentPhone}. Status: DELIVERED`);
    logs.push(`[Tutorías] Alerta registrada en el expediente disciplinario. Se pre-agenda espacio de tutoría académica.`);
  } 
  else if (routePath.includes("/api/v1/finance/invoice")) {
    const studentId = body.studentId || "EST-1102";
    const amount = body.amount || 250.00;
    const dueDate = body.dueDate || new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0];
    const invoiceId = "FAC-2026-" + Math.floor(10000 + Math.random() * 90000);

    responseData = {
      success: true,
      invoiceId,
      studentId,
      amount,
      currency: "USD",
      dueDate,
      paymentLink: `https://pay.sis-edu.com/checkout/${invoiceId}`,
      quickbooksSynced: true,
      accountingCode: "REV-TUITION-K12"
    };

    logs.push(`[ERP Financiero] Generando factura recurrente para ciclo de colegiatura.`);
    logs.push(`[QuickBooks API] Sincronizando asiento contable con ID fiscal.`);
    logs.push(`[Pasarela de Pago] Generando enlace seguro de Stripe/PayPal para colegiatura.`);
  } 
  else {
    // Default fallback
    responseData = {
      success: true,
      message: "Operación simulada con éxito",
      method,
      path: routePath,
      receivedData: body,
      simulatedAt: timestamp
    };
    logs.push(`[SIS Core] Endpoint personalizado procesado de forma genérica.`);
  }

  res.json({
    status,
    response: responseData,
    logs
  });
});

// Configure Vite or Static files serving
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static file assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SIS Architect Workbench Server listening on http://0.0.0.0:${PORT}`);
  });
}

configureServer();
