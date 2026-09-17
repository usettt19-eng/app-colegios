import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// ==========================================
// Años Lectivos (Academic Terms)
// ==========================================

// GET /api/v1/academics/terms?tenant_id=...
router.get("/terms", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("academic_terms")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("start_date", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar los años lectivos." });
    return res.status(200).json({ success: true, terms: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/academics/terms:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/terms
router.post("/terms", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, start_date, end_date, is_active } = req.body;
    if (!tenant_id || !name || !start_date || !end_date) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name, start_date, end_date)" });
    }

    if (is_active) {
      // Solo un ciclo activo a la vez por colegio
      await supabaseAdmin.from("academic_terms").update({ is_active: false }).eq("tenant_id", tenant_id);
    }

    const { data: term, error } = await supabaseAdmin
      .from("academic_terms")
      .insert({ tenant_id, name, start_date, end_date, is_active: !!is_active })
      .select()
      .single();

    if (error || !term) {
      console.error("Error al crear año lectivo:", error);
      return res.status(500).json({ error: "Error al crear el año lectivo." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "ACADEMIC",
      description: `Se configuró el año lectivo "${name}" (${start_date} a ${end_date}).`,
      actor_name: "Admin System",
    });

    return res.status(201).json({ success: true, message: "Año lectivo creado.", term });
  } catch (error: any) {
    console.error("Error en POST /api/v1/academics/terms:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// Cursos (Catálogo de Materias)
// ==========================================

// GET /api/v1/academics/courses?tenant_id=...
router.get("/courses", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("courses")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("name");

    if (error) return res.status(500).json({ error: "Error al consultar los cursos." });
    return res.status(200).json({ success: true, courses: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/academics/courses:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/courses
router.post("/courses", async (req: Request, res: Response) => {
  try {
    const { tenant_id, code, name, description, credits } = req.body;
    if (!tenant_id || !code || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, code, name)" });
    }

    const { data: course, error } = await supabaseAdmin
      .from("courses")
      .insert({ tenant_id, code, name, description, credits })
      .select()
      .single();

    if (error || !course) {
      console.error("Error al crear curso:", error);
      if (error?.code === "23505") {
        return res.status(400).json({ error: "Ya existe un curso con ese código." });
      }
      return res.status(500).json({ error: "Error al crear el curso." });
    }

    return res.status(201).json({ success: true, message: "Curso creado en el catálogo.", course });
  } catch (error: any) {
    console.error("Error en POST /api/v1/academics/courses:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// Clases / Grupos (asignación de curso + docente a un ciclo)
// ==========================================

// GET /api/v1/academics/classes?tenant_id=...&term_id=...
router.get("/classes", async (req: Request, res: Response) => {
  try {
    const { tenant_id, term_id, teacher_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin
      .from("classes")
      .select("*, courses(name, code), profiles(first_name, last_name), academic_terms(name)")
      .eq("tenant_id", tenant_id);

    if (term_id) query = query.eq("term_id", term_id);
    if (teacher_id) query = query.eq("teacher_id", teacher_id);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar las clases." });
    return res.status(200).json({ success: true, classes: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/academics/classes:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/academics/classes/:id/roster
// Lista los alumnos matriculados en un grupo/clase específico (para pase de lista y calificaciones)
router.get("/classes/:id/roster", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("class_enrollments")
      .select("id, final_grade, enrollments!inner(student_id, students(id, first_name, last_name, photo_url))")
      .eq("class_id", id);

    if (error) return res.status(500).json({ error: "Error al consultar el roster de la clase." });

    const roster = (data || []).map((ce: any) => ({
      class_enrollment_id: ce.id,
      final_grade: ce.final_grade,
      student_id: ce.enrollments?.student_id,
      first_name: ce.enrollments?.students?.first_name,
      last_name: ce.enrollments?.students?.last_name,
      photo_url: ce.enrollments?.students?.photo_url,
    }));

    return res.status(200).json({ success: true, roster });
  } catch (error: any) {
    console.error("Error en GET /api/v1/academics/classes/:id/roster:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/classes
router.post("/classes", async (req: Request, res: Response) => {
  try {
    const { tenant_id, term_id, course_id, teacher_id, name, capacity } = req.body;
    if (!tenant_id || !term_id || !course_id || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, term_id, course_id, name)" });
    }

    const { data: classGroup, error } = await supabaseAdmin
      .from("classes")
      .insert({ tenant_id, term_id, course_id, teacher_id: teacher_id || null, name, capacity: capacity || 30 })
      .select()
      .single();

    if (error || !classGroup) {
      console.error("Error al crear la clase:", error);
      return res.status(500).json({ error: "Error al crear el grupo/clase." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "ACADEMIC",
      description: `Se creó el grupo "${name}" y se asignó al distributivo docente.`,
      actor_name: "Admin System",
    });

    return res.status(201).json({ success: true, message: "Grupo/clase creado y asignado.", class: classGroup });
  } catch (error: any) {
    console.error("Error en POST /api/v1/academics/classes:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// Horarios (Class Schedules)
// ==========================================

// GET /api/v1/academics/schedules?class_id=...
router.get("/schedules", async (req: Request, res: Response) => {
  try {
    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ error: "Falta class_id" });

    const { data, error } = await supabaseAdmin
      .from("class_schedules")
      .select("*")
      .eq("class_id", class_id)
      .order("day_of_week");

    if (error) return res.status(500).json({ error: "Error al consultar el horario." });
    return res.status(200).json({ success: true, schedules: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/academics/schedules:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/schedules
router.post("/schedules", async (req: Request, res: Response) => {
  try {
    const { tenant_id, class_id, day_of_week, start_time, end_time, room_number } = req.body;
    if (!tenant_id || !class_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, class_id, day_of_week, start_time, end_time)" });
    }

    const { data: schedule, error } = await supabaseAdmin
      .from("class_schedules")
      .insert({ tenant_id, class_id, day_of_week, start_time, end_time, room_number })
      .select()
      .single();

    if (error || !schedule) {
      console.error("Error al crear horario:", error);
      if (error?.code === "23505") {
        return res.status(400).json({ error: "Ya existe un bloque de horario igual para esta clase." });
      }
      return res.status(500).json({ error: "Error al crear el bloque de horario." });
    }

    return res.status(201).json({ success: true, message: "Bloque de horario creado.", schedule });
  } catch (error: any) {
    console.error("Error en POST /api/v1/academics/schedules:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
