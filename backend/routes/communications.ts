import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { sendEmail, getOfficialEmailTemplate } from "../services/emailService";

const router = Router();

// POST /api/v1/communications/broadcast
// Enviar circulares masivas o mensajes por grado
router.post("/broadcast", async (req: Request, res: Response) => {
  try {
    const { tenant_id, sender_id, target_class_id, subject, html_body } = req.body;

    if (!tenant_id || !subject || !html_body) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (asunto o mensaje)." });
    }

    let query = supabaseAdmin
      .from("parent_students")
      .select("profiles!inner(email)");

    // Si se especifica una clase, filtramos a los padres de esos alumnos
    if (target_class_id) {
      // 1. Obtener alumnos de la clase
      const { data: classEnrollments } = await supabaseAdmin
        .from("class_enrollments")
        .select("enrollments!inner(student_id)")
        .eq("class_id", target_class_id);
      
      const studentIds = classEnrollments?.map((ce: any) => ce.enrollments.student_id) || [];
      
      if (studentIds.length > 0) {
        query = query.in("student_id", studentIds);
      } else {
        return res.status(400).json({ error: "No hay alumnos inscritos en esta clase." });
      }
    }

    const { data: parents, error } = await query;

    if (error || !parents) {
      return res.status(500).json({ error: "Error consultando la base de padres." });
    }

    // Extraer emails únicos
    const emailSet = new Set<string>();
    parents.forEach((p: any) => {
      if (p.profiles?.email) emailSet.add(p.profiles.email);
    });
    
    const emails = Array.from(emailSet);

    if (emails.length === 0) {
      return res.status(400).json({ error: "No se encontraron correos electrónicos válidos." });
    }

    // Generar la plantilla final
    const finalHtml = getOfficialEmailTemplate(subject, html_body);

    // Enviar correos
    await sendEmail(emails, subject, finalHtml);

    // Auditoría de la Circular
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SYSTEM",
      description: `Se envió un comunicado masivo (Asunto: ${subject}) a ${emails.length} destinatarios.`,
      actor_name: "Communications Module"
    });

    return res.status(200).json({ 
      success: true, 
      message: `Comunicado enviado exitosamente a ${emails.length} correos.`,
      emails_reached: emails.length
    });

  } catch (error: any) {
    console.error("Error en POST /api/v1/communications/broadcast:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// POST /api/v1/communications/internal
// Envío de correos institucionales al STAFF según la estructura jerárquica
router.post("/internal", async (req: Request, res: Response) => {
  try {
    const { tenant_id, sender_role, target_audience, department_id, subject, html_body } = req.body;
    // target_audience puede ser: 'all_staff', 'all_teachers', 'department_only', 'direct_reports'

    if (!tenant_id || !target_audience || !subject || !html_body) {
      return res.status(400).json({ error: "Parámetros incompletos." });
    }

    let query = supabaseAdmin.from("profiles").select("email").eq("tenant_id", tenant_id);

    // Lógica de ruteo por Organigrama y Jerarquía
    switch (target_audience) {
      case 'all_staff':
        query = query.in("role", ["admin", "super_admin", "staff", "teacher"]);
        break;
      case 'all_teachers':
        query = query.eq("role", "teacher");
        break;
      case 'department_only':
        if (!department_id) return res.status(400).json({ error: "Debe especificar el department_id" });
        query = query.eq("department_id", department_id);
        break;
      case 'direct_reports':
        // Enviar a todos los empleados que reportan directamente al remitente
        const { sender_id } = req.body;
        if (!sender_id) return res.status(400).json({ error: "Se requiere sender_id para direct_reports." });
        query = query.eq("reports_to", sender_id);
        break;
      default:
        return res.status(400).json({ error: "Audiencia no válida." });
    }

    const { data: staffMembers, error } = await query.not("email", "is", null);

    if (error || !staffMembers || staffMembers.length === 0) {
      return res.status(404).json({ error: "No se encontraron empleados en ese nivel jerárquico." });
    }

    const emails = staffMembers.map(m => m.email);
    const finalHtml = getOfficialEmailTemplate(`Comunicado Institucional: ${subject}`, html_body);
    
    await sendEmail(emails, subject, finalHtml);

    return res.status(200).json({ 
      success: true, 
      message: `Mensaje interno entregado a ${emails.length} miembros del staff.`,
      target_audience
    });

  } catch (error) {
    console.error("Error en comunicaciones internas:", error);
    return res.status(500).json({ error: "Error interno." });
  }
});

export default router;
