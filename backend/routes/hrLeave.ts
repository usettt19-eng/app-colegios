import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// ==========================================
// VACACIONES E INCAPACIDADES (AUSENCIAS)
// ==========================================

// GET /api/v1/hr-leave/requests?tenant_id=...
// Lista las solicitudes de ausencia del colegio (para RRHH/Coordinación)
router.get("/requests", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .select("*, hr_employees(profile_id, vacation_days_balance, profiles(first_name, last_name))")
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar las solicitudes de ausencia." });
    return res.status(200).json({ success: true, leaveRequests: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/hr-leave/requests:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/hr-leave/requests
// El empleado (o RRHH en su nombre) solicita vacaciones/incapacidad/permiso.
// days_requested se pide explícito (no se calcula solo, porque contar días
// hábiles vs. calendario depende de la política de cada colegio) en vez de
// inferirlo restando fechas.
router.post("/requests", async (req: Request, res: Response) => {
  try {
    const { tenant_id, employee_id, leave_type, start_date, end_date, days_requested, reason } = req.body;

    if (!tenant_id || !employee_id || !leave_type || !start_date || !end_date || !days_requested) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, employee_id, leave_type, start_date, end_date, days_requested)" });
    }
    if (!["vacation", "sick", "personal", "other"].includes(leave_type)) {
      return res.status(400).json({ error: "Tipo de ausencia inválido." });
    }

    const { data: request, error } = await supabaseAdmin
      .from("leave_requests")
      .insert({ tenant_id, employee_id, leave_type, start_date, end_date, days_requested: Number(days_requested), reason: reason || null })
      .select("*, hr_employees(profile_id, vacation_days_balance, profiles(first_name, last_name))")
      .single();

    if (error || !request) {
      console.error("Error al crear solicitud de ausencia:", error);
      return res.status(500).json({ error: "No se pudo registrar la solicitud." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "HR",
      description: `Nueva solicitud de ausencia (${leave_type}) por ${days_requested} día(s), del ${start_date} al ${end_date}.`,
      actor_name: "HR System",
    });

    return res.status(201).json({ success: true, message: "Solicitud registrada, pendiente de aprobación.", leaveRequest: request });
  } catch (error: any) {
    console.error("Error en POST /api/v1/hr-leave/requests:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/hr-leave/requests/:id/decide
// El gerente/RRHH aprueba o rechaza la solicitud. Al aprobar una de tipo
// "vacation", se descuenta days_requested del saldo anual del empleado
// (hr_employees.vacation_days_balance) — no se permite dejar el saldo en
// negativo. Las de tipo sick/personal/other quedan en el historial pero no
// tocan el saldo de vacaciones (son ausencias justificadas, no vacaciones).
router.post("/requests/:id/decide", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approved_by } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Estado inválido. Usa 'approved' o 'rejected'." });
    }

    const { data: request } = await supabaseAdmin
      .from("leave_requests")
      .select("*, hr_employees(id, vacation_days_balance)")
      .eq("id", id)
      .single();

    if (!request) return res.status(404).json({ error: "Solicitud no encontrada." });
    if (request.status !== "pending") {
      return res.status(400).json({ error: "Esta solicitud ya fue decidida." });
    }

    if (status === "approved" && request.leave_type === "vacation") {
      const currentBalance = Number(request.hr_employees?.vacation_days_balance || 0);
      if (currentBalance < Number(request.days_requested)) {
        return res.status(400).json({ error: `Saldo de vacaciones insuficiente (disponible: ${currentBalance} días, solicitados: ${request.days_requested}).` });
      }
      await supabaseAdmin
        .from("hr_employees")
        .update({ vacation_days_balance: Number((currentBalance - Number(request.days_requested)).toFixed(2)) })
        .eq("id", request.employee_id);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("leave_requests")
      .update({ status, approved_by: approved_by || null, approved_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, hr_employees(profile_id, vacation_days_balance, profiles(first_name, last_name))")
      .single();

    if (error || !updated) return res.status(500).json({ error: "No se pudo actualizar la solicitud." });

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: request.tenant_id,
      event_type: "HR",
      description: `Solicitud de ausencia (ID: ${id}) ${status === "approved" ? "aprobada" : "rechazada"}.`,
      actor_name: "HR System",
    });

    return res.status(200).json({ success: true, message: `Solicitud ${status === "approved" ? "aprobada" : "rechazada"}.`, leaveRequest: updated });
  } catch (error: any) {
    console.error("Error en POST /api/v1/hr-leave/requests/:id/decide:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/hr-leave/employees/:id/vacation-balance
// Ajuste manual del saldo de vacaciones de un empleado (ej. saldo inicial
// al darlo de alta, o corrección). No se asume ninguna cantidad de días por
// defecto/país — cada colegio y contrato define su propia política.
router.patch("/employees/:id/vacation-balance", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vacation_days_balance } = req.body;
    if (vacation_days_balance === undefined) return res.status(400).json({ error: "Falta vacation_days_balance" });

    const { data: employee, error } = await supabaseAdmin
      .from("hr_employees")
      .update({ vacation_days_balance: Number(vacation_days_balance) })
      .eq("id", id)
      .select()
      .single();

    if (error || !employee) return res.status(404).json({ error: "Empleado no encontrado." });

    return res.status(200).json({ success: true, message: "Saldo de vacaciones actualizado.", employee });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/hr-leave/employees/:id/vacation-balance:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// ASIGNACIÓN DE SUPLENCIAS
// ==========================================

// GET /api/v1/hr-leave/substitute-assignments?tenant_id=...
// Lista las suplencias asignadas (para Coordinación)
router.get("/substitute-assignments", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("substitute_assignments")
      .select(`
        *,
        classes(name, courses(name)),
        original_teacher:profiles!substitute_assignments_original_teacher_id_fkey(first_name, last_name),
        substitute_teacher:profiles!substitute_assignments_substitute_teacher_id_fkey(first_name, last_name)
      `)
      .eq("tenant_id", tenant_id)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error al consultar suplencias:", error);
      return res.status(500).json({ error: "Error al consultar las suplencias." });
    }
    return res.status(200).json({ success: true, substituteAssignments: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/hr-leave/substitute-assignments:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/hr-leave/substitute-assignments
// Coordinación reasigna las clases de un docente ausente (un día
// específico) a un suplente. Esto afecta el pago por horas de ambos: al
// calcular la planilla, computeScheduledHours() (corporate.ts) resta esas
// horas del titular ese día y se las suma al suplente.
router.post("/substitute-assignments", async (req: Request, res: Response) => {
  try {
    const { tenant_id, class_id, date, substitute_teacher_id, leave_request_id, notes, created_by } = req.body;

    if (!tenant_id || !class_id || !date || !substitute_teacher_id) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, class_id, date, substitute_teacher_id)" });
    }

    const { data: classRow } = await supabaseAdmin.from("classes").select("teacher_id").eq("id", class_id).single();
    if (!classRow) return res.status(404).json({ error: "Grupo/clase no encontrado." });
    if (!classRow.teacher_id) return res.status(400).json({ error: "Este grupo no tiene un docente titular asignado." });
    if (classRow.teacher_id === substitute_teacher_id) {
      return res.status(400).json({ error: "El suplente no puede ser el mismo docente titular." });
    }

    const { data: assignment, error } = await supabaseAdmin
      .from("substitute_assignments")
      .insert({
        tenant_id, class_id, date, original_teacher_id: classRow.teacher_id, substitute_teacher_id,
        leave_request_id: leave_request_id || null, notes: notes || null, created_by: created_by || null,
      })
      .select(`
        *,
        classes(name, courses(name)),
        original_teacher:profiles!substitute_assignments_original_teacher_id_fkey(first_name, last_name),
        substitute_teacher:profiles!substitute_assignments_substitute_teacher_id_fkey(first_name, last_name)
      `)
      .single();

    if (error || !assignment) {
      if ((error as any)?.code === "23505") {
        return res.status(400).json({ error: "Ya hay un suplente asignado a este grupo en esa fecha." });
      }
      console.error("Error al asignar suplencia:", error);
      return res.status(500).json({ error: "No se pudo asignar la suplencia." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "HR",
      description: `Suplencia asignada para el grupo (ID: ${class_id}) el ${date}: titular (ID: ${classRow.teacher_id}) reemplazado por suplente (ID: ${substitute_teacher_id}).`,
      actor_name: "HR System",
    });

    return res.status(201).json({ success: true, message: "Suplencia asignada.", substituteAssignment: assignment });
  } catch (error: any) {
    console.error("Error en POST /api/v1/hr-leave/substitute-assignments:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/hr-leave/substitute-assignments/:id
router.delete("/substitute-assignments/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("substitute_assignments").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "No se pudo eliminar la suplencia." });
    return res.status(200).json({ success: true, message: "Suplencia eliminada." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/hr-leave/substitute-assignments/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
