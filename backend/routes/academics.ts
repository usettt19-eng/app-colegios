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
      .select("*, course_grade_levels(grade_level_id, weekly_hours, grade_levels(id, name))")
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
// Además de crear el curso en el catálogo, permite indicar de una vez a
// qué grados aplica (grade_level_ids), para poder generar sus grupos
// masivamente después con POST /courses/:id/generate-groups.
router.post("/courses", async (req: Request, res: Response) => {
  try {
    const { tenant_id, code, name, area, description, grade_level_ids } = req.body;
    if (!tenant_id || !code || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, code, name)" });
    }

    const { data: course, error } = await supabaseAdmin
      .from("courses")
      .insert({ tenant_id, code, name, area: area || null, description })
      .select()
      .single();

    if (error || !course) {
      console.error("Error al crear curso:", error);
      if (error?.code === "23505") {
        return res.status(400).json({ error: "Ya existe un curso con ese código." });
      }
      return res.status(500).json({ error: "Error al crear el curso." });
    }

    if (Array.isArray(grade_level_ids) && grade_level_ids.length > 0) {
      await supabaseAdmin.from("course_grade_levels").insert(
        grade_level_ids.map((grade_level_id: string) => ({ tenant_id, course_id: course.id, grade_level_id }))
      );
    }

    return res.status(201).json({ success: true, message: "Curso creado en el catálogo.", course });
  } catch (error: any) {
    console.error("Error en POST /api/v1/academics/courses:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/courses/:id/grade-levels
// Marca (agrega) un grado a la matriz de plan de estudios de este curso,
// con sus horas semanales propias (pueden variar entre grados).
router.post("/courses/:id/grade-levels", async (req: Request, res: Response) => {
  try {
    const { id: course_id } = req.params;
    const { tenant_id, grade_level_id, weekly_hours } = req.body;
    if (!tenant_id || !grade_level_id) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, grade_level_id)" });

    const { error } = await supabaseAdmin
      .from("course_grade_levels")
      .upsert({ tenant_id, course_id, grade_level_id, weekly_hours: weekly_hours ?? null }, { onConflict: "course_id, grade_level_id" });

    if (error) return res.status(500).json({ error: "No se pudo marcar el grado para este curso." });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error en POST /api/v1/academics/courses/:id/grade-levels:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/academics/courses/:id/grade-levels/:gradeLevelId
// Edita solo las horas semanales de un curso ya asignado a un grado
// (sin desmarcarlo/rehacerlo).
router.patch("/courses/:id/grade-levels/:gradeLevelId", async (req: Request, res: Response) => {
  try {
    const { id: course_id, gradeLevelId } = req.params;
    const { weekly_hours } = req.body;

    const { error } = await supabaseAdmin
      .from("course_grade_levels")
      .update({ weekly_hours: weekly_hours ?? null })
      .eq("course_id", course_id)
      .eq("grade_level_id", gradeLevelId);

    if (error) return res.status(500).json({ error: "No se pudieron actualizar las horas semanales." });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/academics/courses/:id/grade-levels/:gradeLevelId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/academics/courses/:id/grade-levels/:gradeLevelId
// Desmarca (quita) un grado de la matriz de plan de estudios de este curso.
router.delete("/courses/:id/grade-levels/:gradeLevelId", async (req: Request, res: Response) => {
  try {
    const { id: course_id, gradeLevelId } = req.params;

    const { error } = await supabaseAdmin
      .from("course_grade_levels")
      .delete()
      .eq("course_id", course_id)
      .eq("grade_level_id", gradeLevelId);

    if (error) return res.status(500).json({ error: "No se pudo desmarcar el grado para este curso." });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/academics/courses/:id/grade-levels/:gradeLevelId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/courses/:id/generate-groups
// Genera automáticamente un grupo (classes) por cada sección de los
// grados asignados a este curso, para el término indicado — en vez de
// crear cada grupo a mano, uno por sección.
router.post("/courses/:id/generate-groups", async (req: Request, res: Response) => {
  try {
    const { id: course_id } = req.params;
    const { tenant_id, term_id, teacher_id } = req.body;
    if (!tenant_id || !term_id) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, term_id)" });

    const { data: course } = await supabaseAdmin.from("courses").select("name").eq("id", course_id).single();
    if (!course) return res.status(404).json({ error: "Curso no encontrado." });

    const { data: mappings, error: mappingsError } = await supabaseAdmin
      .from("course_grade_levels")
      .select("grade_level_id, grade_levels(name, grade_sections(id, name))")
      .eq("course_id", course_id);

    if (mappingsError) return res.status(500).json({ error: "Error al consultar el plan de estudios del curso." });
    if (!mappings || mappings.length === 0) {
      return res.status(400).json({ error: "Este curso no tiene grados asignados. Edítalo para asignarle al menos uno." });
    }

    let created = 0;
    const skipped: string[] = [];

    for (const mapping of mappings) {
      const gradeLevel: any = mapping.grade_levels;
      const sections: any[] = gradeLevel?.grade_sections || [];
      for (const section of sections) {
        const { error: insertError } = await supabaseAdmin.from("classes").insert({
          tenant_id,
          term_id,
          course_id,
          teacher_id: teacher_id || null,
          grade_section_id: section.id,
          name: `${gradeLevel.name} - ${section.name}`,
        });

        if (insertError) {
          // El índice único (term_id, course_id, grade_section_id) rechaza duplicados
          skipped.push(`${gradeLevel.name} - ${section.name}`);
          continue;
        }
        created++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `${created} grupo(s) creado(s) para "${course.name}".`,
      created,
      skipped,
    });
  } catch (error: any) {
    console.error("Error en POST /api/v1/academics/courses/:id/generate-groups:", error);
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
      .select("*, courses(name, code), profiles(first_name, last_name), academic_terms(name), grade_sections(grade_level_id, name, grade_levels(name))")
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
      .select("id, final_grade, enrollment_id, enrollments!inner(student_id, students(id, first_name, last_name, photo_url))")
      .eq("class_id", id);

    if (error) return res.status(500).json({ error: "Error al consultar el roster de la clase." });

    const roster = (data || []).map((ce: any) => ({
      class_enrollment_id: ce.id,
      enrollment_id: ce.enrollment_id,
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

// PATCH /api/v1/academics/class-enrollments/:id
// El docente registra/actualiza la nota final del alumno en esta materia
// (alimenta el cálculo de GPA al generar el boletín)
router.patch("/class-enrollments/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { final_grade } = req.body;

    if (final_grade === undefined || final_grade === null || final_grade === "") {
      return res.status(400).json({ error: "Falta la nota final." });
    }

    const { data, error } = await supabaseAdmin
      .from("class_enrollments")
      .update({ final_grade: Number(final_grade) })
      .eq("id", id)
      .select("id, final_grade, enrollment_id")
      .single();

    if (error || !data) return res.status(404).json({ error: "Matrícula de clase no encontrada." });

    return res.status(200).json({ success: true, message: "Nota final guardada.", classEnrollment: data });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/academics/class-enrollments/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/classes
router.post("/classes", async (req: Request, res: Response) => {
  try {
    const { tenant_id, term_id, course_id, teacher_id, grade_section_id, name, capacity } = req.body;
    if (!tenant_id || !term_id || !course_id || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, term_id, course_id, name)" });
    }

    const { data: classGroup, error } = await supabaseAdmin
      .from("classes")
      .insert({
        tenant_id, term_id, course_id, teacher_id: teacher_id || null,
        grade_section_id: grade_section_id || null, name, capacity: capacity || 30,
      })
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

// PATCH /api/v1/academics/classes/:id
// Reasigna el docente, el grado-sección, el nombre o la capacidad de un
// grupo ya creado (un docente puede tener varios classes: distintos
// cursos, grados y secciones a la vez).
router.patch("/classes/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { teacher_id, grade_section_id, name, capacity } = req.body;

    const updates: Record<string, any> = {};
    if (teacher_id !== undefined) updates.teacher_id = teacher_id || null;
    if (grade_section_id !== undefined) updates.grade_section_id = grade_section_id || null;
    if (name !== undefined) updates.name = name;
    if (capacity !== undefined) updates.capacity = capacity;

    const { data: classGroup, error } = await supabaseAdmin
      .from("classes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !classGroup) return res.status(404).json({ error: "Grupo/clase no encontrado." });

    return res.status(200).json({ success: true, message: "Grupo/clase actualizado.", class: classGroup });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/academics/classes/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// Horarios (Class Schedules)
// ==========================================

// GET /api/v1/academics/schedules?class_id=...
// GET /api/v1/academics/schedules?tenant_id=...&teacher_id=... (distributivo: todos los bloques de un docente)
router.get("/schedules", async (req: Request, res: Response) => {
  try {
    const { class_id, tenant_id, teacher_id } = req.query;

    if (class_id) {
      const { data, error } = await supabaseAdmin
        .from("class_schedules")
        .select("*")
        .eq("class_id", class_id)
        .order("day_of_week");

      if (error) return res.status(500).json({ error: "Error al consultar el horario." });
      return res.status(200).json({ success: true, schedules: data });
    }

    if (!tenant_id) return res.status(400).json({ error: "Falta class_id o tenant_id" });

    let query = supabaseAdmin
      .from("class_schedules")
      .select("*, classes!inner(id, name, teacher_id, course_id, courses(name), grade_sections(name, grade_levels(name)))")
      .eq("tenant_id", tenant_id);

    if (teacher_id) query = query.eq("classes.teacher_id", teacher_id);

    const { data, error } = await query.order("day_of_week");
    if (error) return res.status(500).json({ error: "Error al consultar el horario." });
    return res.status(200).json({ success: true, schedules: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/academics/schedules:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/academics/schedules
// Valida que el docente de la clase no tenga ya otro bloque cruzado el mismo día/hora
// (un docente puede tener varias classes: distintos cursos, grados y secciones).
router.post("/schedules", async (req: Request, res: Response) => {
  try {
    const { tenant_id, class_id, day_of_week, start_time, end_time, room_number } = req.body;
    if (!tenant_id || !class_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, class_id, day_of_week, start_time, end_time)" });
    }
    if (start_time >= end_time) {
      return res.status(400).json({ error: "La hora de inicio debe ser antes de la hora de fin." });
    }

    const { data: classGroup } = await supabaseAdmin
      .from("classes")
      .select("teacher_id")
      .eq("id", class_id)
      .single();

    if (classGroup?.teacher_id) {
      const { data: teacherBlocks } = await supabaseAdmin
        .from("class_schedules")
        .select("start_time, end_time, classes!inner(teacher_id)")
        .eq("day_of_week", day_of_week)
        .eq("classes.teacher_id", classGroup.teacher_id);

      const hasConflict = (teacherBlocks || []).some(
        (b: any) => start_time < b.end_time && end_time > b.start_time
      );
      if (hasConflict) {
        return res.status(409).json({ error: "El docente ya tiene otro bloque de horario que se cruza ese día y hora." });
      }
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

// DELETE /api/v1/academics/schedules/:id
router.delete("/schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("class_schedules").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "Error al eliminar el bloque de horario." });
    return res.status(200).json({ success: true, message: "Bloque de horario eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/academics/schedules/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
