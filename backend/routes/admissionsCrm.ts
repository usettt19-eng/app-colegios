import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

const VALID_STAGES = new Set(["interesado", "visita_agendada", "examen_admision", "matriculado", "perdido"]);

// GET /api/v1/admissions-crm/prospects?tenant_id=...
// Lista todos los prospectos del pipeline de admisiones (para el tablero
// Kanban), con el grado deseado y el staff asignado.
router.get("/prospects", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("admission_prospects")
      .select("*, grade_levels(name), profiles(first_name, last_name)")
      .eq("tenant_id", tenant_id)
      .order("stage_updated_at", { ascending: false });

    if (error) {
      console.error("Error al consultar prospectos:", error);
      return res.status(500).json({ error: "Error al consultar el pipeline de admisiones." });
    }

    return res.status(200).json({ success: true, prospects: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/admissions-crm/prospects:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/admissions-crm/prospects
// Registra un nuevo prospecto (primer contacto), entra al pipeline en
// etapa "interesado".
router.post("/prospects", async (req: Request, res: Response) => {
  try {
    const {
      tenant_id, student_first_name, student_last_name, desired_grade_level_id,
      parent_name, parent_email, parent_phone, source, assigned_to,
    } = req.body;

    if (!tenant_id || !student_first_name || !student_last_name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, student_first_name, student_last_name)" });
    }

    const { data: prospect, error } = await supabaseAdmin
      .from("admission_prospects")
      .insert({
        tenant_id, student_first_name, student_last_name,
        desired_grade_level_id: desired_grade_level_id || null,
        parent_name: parent_name || null, parent_email: parent_email || null, parent_phone: parent_phone || null,
        source: source || null, assigned_to: assigned_to || null,
      })
      .select("*, grade_levels(name), profiles(first_name, last_name)")
      .single();

    if (error || !prospect) {
      console.error("Error al crear prospecto:", error);
      return res.status(500).json({ error: "No se pudo registrar el prospecto." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SYSTEM",
      description: `Nuevo prospecto de admisión registrado: ${student_first_name} ${student_last_name}.`,
      actor_name: "Admissions CRM",
    });

    return res.status(201).json({ success: true, message: "Prospecto registrado en el pipeline.", prospect });
  } catch (error: any) {
    console.error("Error en POST /api/v1/admissions-crm/prospects:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/admissions-crm/prospects/:id
// Actualiza los datos de seguimiento de un prospecto (visita, examen,
// notas, asignación) sin cambiar su etapa.
router.patch("/prospects/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      student_first_name, student_last_name, desired_grade_level_id,
      parent_name, parent_email, parent_phone, source, assigned_to,
      visit_date, exam_date, exam_score, notes,
    } = req.body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (student_first_name !== undefined) updates.student_first_name = student_first_name;
    if (student_last_name !== undefined) updates.student_last_name = student_last_name;
    if (desired_grade_level_id !== undefined) updates.desired_grade_level_id = desired_grade_level_id || null;
    if (parent_name !== undefined) updates.parent_name = parent_name;
    if (parent_email !== undefined) updates.parent_email = parent_email;
    if (parent_phone !== undefined) updates.parent_phone = parent_phone;
    if (source !== undefined) updates.source = source;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (visit_date !== undefined) updates.visit_date = visit_date || null;
    if (exam_date !== undefined) updates.exam_date = exam_date || null;
    if (exam_score !== undefined) updates.exam_score = exam_score === "" ? null : exam_score;
    if (notes !== undefined) updates.notes = notes;

    const { data: prospect, error } = await supabaseAdmin
      .from("admission_prospects")
      .update(updates)
      .eq("id", id)
      .select("*, grade_levels(name), profiles(first_name, last_name)")
      .single();

    if (error || !prospect) return res.status(404).json({ error: "Prospecto no encontrado." });

    return res.status(200).json({ success: true, message: "Prospecto actualizado.", prospect });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/admissions-crm/prospects/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/admissions-crm/prospects/:id/stage
// Mueve un prospecto a otra etapa del pipeline (arrastrar tarjeta en el
// Kanban). "perdido" requiere un motivo.
router.post("/prospects/:id/stage", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stage, lost_reason } = req.body;

    if (!VALID_STAGES.has(stage)) {
      return res.status(400).json({ error: "Etapa inválida." });
    }
    if (stage === "perdido" && !lost_reason) {
      return res.status(400).json({ error: "Indica el motivo por el que se perdió el prospecto." });
    }

    const { data: current } = await supabaseAdmin.from("admission_prospects").select("tenant_id, student_first_name, student_last_name, stage").eq("id", id).single();
    if (!current) return res.status(404).json({ error: "Prospecto no encontrado." });

    const { data: prospect, error } = await supabaseAdmin
      .from("admission_prospects")
      .update({
        stage,
        stage_updated_at: new Date().toISOString(),
        lost_reason: stage === "perdido" ? lost_reason : null,
      })
      .eq("id", id)
      .select("*, grade_levels(name), profiles(first_name, last_name)")
      .single();

    if (error || !prospect) return res.status(500).json({ error: "No se pudo mover el prospecto de etapa." });

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: current.tenant_id,
      event_type: "SYSTEM",
      description: `El prospecto ${current.student_first_name} ${current.student_last_name} pasó de "${current.stage}" a "${stage}".`,
      actor_name: "Admissions CRM",
    });

    return res.status(200).json({ success: true, message: "Etapa actualizada.", prospect });
  } catch (error: any) {
    console.error("Error en POST /api/v1/admissions-crm/prospects/:id/stage:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/admissions-crm/prospects/:id/link-student
// Vincula el prospecto con el expediente de alumno real ya creado (paso
// "Convertir a Matrícula" del pipeline, que crea el expediente vía el
// flujo normal de Admisiones y luego llama aquí) y lo pasa a "matriculado".
router.post("/prospects/:id/link-student", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: "Falta student_id" });

    const { data: prospect, error } = await supabaseAdmin
      .from("admission_prospects")
      .update({
        converted_student_id: student_id,
        stage: "matriculado",
        stage_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !prospect) return res.status(404).json({ error: "Prospecto no encontrado." });

    return res.status(200).json({ success: true, message: "Prospecto vinculado al expediente de alumno.", prospect });
  } catch (error: any) {
    console.error("Error en POST /api/v1/admissions-crm/prospects/:id/link-student:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
