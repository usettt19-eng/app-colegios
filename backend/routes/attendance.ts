import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { sendAbsenceAlertSMS } from "../services/twilioService";

const router = Router();

// POST /api/v1/attendance/record
// El profesor o bedel registra la asistencia de una clase
router.post("/record", async (req: Request, res: Response) => {
  try {
    const { tenant_id, class_id, teacher_id, records } = req.body;

    if (!tenant_id || !class_id || !Array.isArray(records)) {
      return res.status(400).json({ error: "Parámetros inválidos." });
    }

    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const insertData = records.map(record => ({
      tenant_id,
      class_id,
      recorded_by: teacher_id,
      student_id: record.student_id,
      status: record.status,
      notes: record.notes || null,
      date
    }));

    const { error: insertError } = await supabaseAdmin
      .from("attendance_records")
      .upsert(insertData, { onConflict: "student_id, class_id, date" });

    if (insertError) {
      console.error("Error al registrar asistencia:", insertError);
      return res.status(500).json({ error: "Fallo al guardar en la base de datos." });
    }
    
    // --- LÓGICA DE ALERTA DE DESERCIÓN Y TWILIO ---
    const absentStudents = records.filter(r => r.status === "absent").map(r => r.student_id);
    
    for (const student_id of absentStudents) {
      const { count } = await supabaseAdmin
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student_id)
        .eq("status", "absent");

      if (count && count >= 3) {
        // 1. Obtener datos del alumno y teléfono del padre principal
        const { data: studentInfo } = await supabaseAdmin
          .from("students")
          .select(`
            first_name, 
            parent_students!inner ( profiles ( phone ) )
          `)
          .eq("id", student_id)
          .single();

        // 2. Registrar la alerta en la base de datos
        await supabaseAdmin.from("student_alerts").insert({
          tenant_id,
          student_id,
          type: "CRITICAL_ABSENCE_STREAK",
          risk_level: "high",
          description: `El estudiante ha acumulado ${count} faltas. Se recomienda intervención de tutoría y contacto con representantes.`
        });
        
        await supabaseAdmin.from("audit_logs").insert({
          tenant_id,
          event_type: "WELLNESS",
          description: `Alerta generada para ID: ${student_id} por ausentismo recurrente. SMS de Twilio disparado.`,
          actor_name: "SIS Core System"
        });

        // 3. ¡Ejecutar Integración Externa con Twilio SMS!
        const parentPhone = studentInfo?.parent_students?.[0]?.profiles?.[0]?.phone;
        if (parentPhone) {
          await sendAbsenceAlertSMS(parentPhone, studentInfo.first_name, count);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Pase de lista registrado y motor de alertas ejecutado."
    });

  } catch (error: any) {
    console.error("Error en POST /api/v1/attendance/record:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/attendance/alert/:student_id
// Consulta si un alumno tiene alertas de deserción pendientes
router.get("/alert/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;

    const { data: alerts, error } = await supabaseAdmin
      .from("student_alerts")
      .select("*")
      .eq("student_id", student_id)
      .eq("is_resolved", false)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error de consulta" });

    return res.status(200).json({ success: true, alerts });
  } catch (error: any) {
    console.error("Error GET /alert:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
