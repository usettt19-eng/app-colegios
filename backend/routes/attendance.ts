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

// GET /api/v1/attendance/history/:student_id
// Historial completo de asistencia de un alumno (para el Expediente del
// Alumno del lado del colegio), con un resumen de faltas/tardanzas.
router.get("/history/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .select("id, date, status, notes, class_id, classes(name, courses(name))")
      .eq("student_id", student_id)
      .order("date", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar el historial de asistencia." });

    const records = data || [];
    const summary = {
      present: records.filter(r => r.status === "present").length,
      absent: records.filter(r => r.status === "absent").length,
      late: records.filter(r => r.status === "late").length,
      excused: records.filter(r => r.status === "excused").length,
    };

    return res.status(200).json({ success: true, records, summary });
  } catch (error: any) {
    console.error("Error en GET /api/v1/attendance/history/:student_id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/attendance/alerts-history/:student_id
// Historial COMPLETO de alertas (resueltas y pendientes) de un alumno, para
// el Expediente del Alumno. El endpoint /alert/:student_id existente solo
// devuelve las pendientes (uso operativo del día a día).
router.get("/alerts-history/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("student_alerts")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error de consulta" });

    return res.status(200).json({ success: true, alerts: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/attendance/alerts-history/:student_id:", error);
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

// GET /api/v1/attendance/risk-dashboard?tenant_id=...
// Analítica Predictiva (Alerta Temprana): cruza tres señales que YA existen
// en el sistema (no se inventa ningún umbral nuevo) para marcar qué
// alumnos tienen riesgo de reprobar/desertar:
//   1. Ausencias acumuladas >= 3 — el mismo umbral que ya dispara la
//      alerta CRITICAL_ABSENCE_STREAK y el SMS de Twilio (POST /record).
//   2. Al menos una nota de período por debajo de tenants.passing_grade
//      (la nota de aprobación que el propio colegio configuró en Admin).
//   3. Alertas activas sin resolver en student_alerts (cualquier tipo:
//      ausentismo, notas bajas, disciplina).
// riesgo = "alto" si tiene 2 o más señales, "medio" si tiene 1, "ninguno"
// si no tiene ninguna.
router.get("/risk-dashboard", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data: tenant } = await supabaseAdmin.from("tenants").select("passing_grade").eq("id", tenant_id).single();
    const passingGrade = Number(tenant?.passing_grade ?? 70);

    const [{ data: students }, { data: absences }, { data: lowGrades }, { data: alerts }] = await Promise.all([
      supabaseAdmin.from("students").select("id, first_name, last_name, grade, section").eq("tenant_id", tenant_id),
      supabaseAdmin.from("attendance_records").select("student_id").eq("tenant_id", tenant_id).eq("status", "absent"),
      supabaseAdmin
        .from("period_grades")
        .select("calculated_grade, class_enrollments(enrollments(student_id))")
        .eq("tenant_id", tenant_id)
        .lt("calculated_grade", passingGrade),
      supabaseAdmin.from("student_alerts").select("student_id").eq("tenant_id", tenant_id).eq("is_resolved", false),
    ]);

    const absenceCounts = new Map<string, number>();
    for (const a of absences || []) absenceCounts.set(a.student_id, (absenceCounts.get(a.student_id) || 0) + 1);

    const lowGradeCounts = new Map<string, number>();
    for (const g of lowGrades || []) {
      const studentId = (g as any).class_enrollments?.enrollments?.student_id;
      if (studentId) lowGradeCounts.set(studentId, (lowGradeCounts.get(studentId) || 0) + 1);
    }

    const alertCounts = new Map<string, number>();
    for (const al of alerts || []) alertCounts.set(al.student_id, (alertCounts.get(al.student_id) || 0) + 1);

    const dashboard = (students || []).map(s => {
      const absenceCount = absenceCounts.get(s.id) || 0;
      const lowGradeCount = lowGradeCounts.get(s.id) || 0;
      const openAlertCount = alertCounts.get(s.id) || 0;

      const signals = [absenceCount >= 3, lowGradeCount > 0, openAlertCount > 0].filter(Boolean).length;
      const riskLevel = signals >= 2 ? "alto" : signals === 1 ? "medio" : "ninguno";

      return {
        student_id: s.id, first_name: s.first_name, last_name: s.last_name, grade: s.grade, section: s.section,
        absence_count: absenceCount, low_grade_count: lowGradeCount, open_alert_count: openAlertCount,
        risk_level: riskLevel,
      };
    });

    dashboard.sort((a, b) => {
      const order: Record<string, number> = { alto: 0, medio: 1, ninguno: 2 };
      return order[a.risk_level] - order[b.risk_level];
    });

    return res.status(200).json({ success: true, passingGrade, dashboard });
  } catch (error: any) {
    console.error("Error en GET /api/v1/attendance/risk-dashboard:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
