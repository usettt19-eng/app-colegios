import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// POST /api/v1/students
// Crea el expediente de un alumno de primer ingreso (inicio del proceso de admisión)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, first_name, last_name, grade, section, parent_id } = req.body;

    if (!tenant_id || !first_name || !last_name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, first_name, last_name)" });
    }

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .insert({ tenant_id, first_name, last_name, grade, section })
      .select()
      .single();

    if (error || !student) {
      console.error("Error al crear alumno:", error);
      return res.status(500).json({ error: "Error al registrar el expediente del alumno." });
    }

    if (parent_id) {
      await supabaseAdmin.from("parent_students").insert({
        parent_id,
        student_id: student.id,
        relationship: "parent",
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SYSTEM",
      description: `Nuevo expediente de admisión creado para ${first_name} ${last_name}.`,
      actor_name: "Admissions CRM",
    });

    return res.status(201).json({ success: true, message: "Expediente de alumno creado.", student });
  } catch (error: any) {
    console.error("Error en POST /api/v1/students:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
