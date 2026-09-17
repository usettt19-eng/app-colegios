import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// POST /api/v1/students
// Crea el expediente de un alumno de primer ingreso (inicio del proceso de admisión)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, first_name, last_name, grade, section, parent_id, photo_url } = req.body;

    if (!tenant_id || !first_name || !last_name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, first_name, last_name)" });
    }

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .insert({ tenant_id, first_name, last_name, grade, section, photo_url: photo_url || null })
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

// GET /api/v1/students/:id
// Consulta el expediente básico del alumno (usado para mostrar su foto y datos generales)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin.from("students").select("*").eq("id", id).single();
    if (error || !data) return res.status(404).json({ error: "Alumno no encontrado." });

    return res.status(200).json({ success: true, student: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/students/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/students/:id/photo
// Actualiza la foto del expediente del alumno
router.post("/:id/photo", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { photo_url } = req.body;

    if (!photo_url) return res.status(400).json({ error: "Falta photo_url" });

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .update({ photo_url })
      .eq("id", id)
      .select()
      .single();

    if (error || !student) return res.status(404).json({ error: "Alumno no encontrado." });

    return res.status(200).json({ success: true, message: "Foto del alumno actualizada.", student });
  } catch (error: any) {
    console.error("Error en POST /api/v1/students/:id/photo:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/students/:id/academic-record
// Consulta el resumen académico vivo del alumno (estado de matrícula, GPA)
router.get("/:id/academic-record", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("student_academic_records")
      .select("*")
      .eq("student_id", id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Sin expediente académico para este alumno." });

    return res.status(200).json({ success: true, academicRecord: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/students/:id/academic-record:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
