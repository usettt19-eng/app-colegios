import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/assignments?class_id=...
// Lista las tareas creadas para una clase
router.get("/", async (req: Request, res: Response) => {
  try {
    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ error: "Falta class_id" });

    const { data, error } = await supabaseAdmin
      .from("assignments")
      .select("*")
      .eq("class_id", class_id)
      .order("due_date", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar las tareas." });
    return res.status(200).json({ success: true, assignments: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/assignments:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/assignments/agenda/:student_id
// Devuelve tareas/exámenes/actividades de todas las clases en las que el
// alumno está matriculado, para el calendario "Notas y Agendas" del Portal
// de Padres. Filtra por rango de fechas opcional (from, to).
router.get("/agenda/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;
    const { from, to } = req.query;

    const { data: enrollments } = await supabaseAdmin
      .from("enrollments")
      .select("id, class_enrollments(class_id)")
      .eq("student_id", student_id);

    const classIds = (enrollments || [])
      .flatMap((e: any) => e.class_enrollments || [])
      .map((ce: any) => ce.class_id)
      .filter(Boolean);

    if (classIds.length === 0) return res.status(200).json({ success: true, agenda: [] });

    let query = supabaseAdmin
      .from("assignments")
      .select("id, title, description, due_date, type, max_score, classes(name, courses(name))")
      .in("class_id", classIds)
      .eq("is_published", true)
      .order("due_date");

    if (from) query = query.gte("due_date", String(from));
    if (to) query = query.lte("due_date", String(to));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "Error al consultar la agenda." });

    return res.status(200).json({ success: true, agenda: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/assignments/agenda/:student_id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/assignments/:id/submissions
// Lista las entregas de los alumnos para una tarea (para calificar)
router.get("/:id/submissions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("student_assignments")
      .select("*, students(first_name, last_name)")
      .eq("assignment_id", id);

    if (error) return res.status(500).json({ error: "Error al consultar las entregas." });
    return res.status(200).json({ success: true, submissions: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/assignments/:id/submissions:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/assignments
// El profesor crea una nueva tarea para una clase
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, class_id, teacher_id, title, description, due_date, max_score, type, grading_period_id } = req.body;

    if (!tenant_id || !class_id || !teacher_id || !title || !due_date) {
      return res.status(400).json({ error: "Faltan parámetros requeridos para crear la tarea." });
    }

    // 1. Crear la tarea principal
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .insert({
        tenant_id,
        class_id,
        created_by: teacher_id,
        title,
        description,
        due_date,
        max_score: max_score || 100,
        type: type || "tarea",
        grading_period_id: grading_period_id || null,
      })
      .select()
      .single();

    if (assignmentError || !assignment) {
      console.error("Error al crear tarea:", assignmentError);
      return res.status(500).json({ error: "Error al generar la tarea en base de datos." });
    }

    // 2. Obtener todos los alumnos matriculados en esta clase
    const { data: enrolledStudents } = await supabaseAdmin
      .from("class_enrollments")
      .select("enrollments (student_id)")
      .eq("class_id", class_id);

    // 3. Asignar la tarea a cada alumno ("Bandeja de entrada" del alumno)
    if (enrolledStudents && enrolledStudents.length > 0) {
      const studentAssignments = enrolledStudents.map((enrollment: any) => ({
        assignment_id: assignment.id,
        student_id: enrollment.enrollments.student_id,
        status: "pending"
      }));

      await supabaseAdmin.from("student_assignments").insert(studentAssignments);

      // (Opcional) Enviar notificaciones a los padres informando sobre la nueva tarea
      for (const sa of studentAssignments) {
        const { data: parents } = await supabaseAdmin
          .from("parent_students")
          .select("parent_id")
          .eq("student_id", sa.student_id);

        if (parents) {
          const notifications = parents.map(p => ({
            tenant_id,
            user_id: p.parent_id,
            title: "Nueva Tarea Asignada",
            message: `Se ha asignado una nueva tarea: "${title}". Fecha límite: ${new Date(due_date).toLocaleDateString()}`,
            type: "info"
          }));
          await supabaseAdmin.from("notifications").insert(notifications);
        }
      }
    }

    // 4. Auditoría
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "ACADEMIC",
      description: `El profesor (ID: ${teacher_id}) asignó la tarea "${title}" a la clase (ID: ${class_id}).`,
      actor_name: "LMS Module"
    });

    return res.status(201).json({
      success: true,
      message: "Tarea creada y asignada a los estudiantes exitosamente.",
      assignment
    });

  } catch (error: any) {
    console.error("Error en POST /api/v1/assignments:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/v1/assignments/grade
// El profesor califica una entrega
router.post("/grade", async (req: Request, res: Response) => {
  try {
    const { student_assignment_id, score, feedback, teacher_id } = req.body;

    const { data: gradedAssignment, error } = await supabaseAdmin
      .from("student_assignments")
      .update({
        status: "graded",
        score,
        teacher_feedback: feedback,
        graded_at: new Date().toISOString()
      })
      .eq("id", student_assignment_id)
      .select("*, assignments(title, tenant_id)")
      .single();

    if (error || !gradedAssignment) {
      return res.status(400).json({ error: "No se pudo calificar la tarea." });
    }

    // Notificar al padre sobre la calificación
    const { data: parents } = await supabaseAdmin
      .from("parent_students")
      .select("parent_id")
      .eq("student_id", gradedAssignment.student_id);

    if (parents) {
      const notifications = parents.map(p => ({
        tenant_id: gradedAssignment.assignments.tenant_id,
        user_id: p.parent_id,
        title: "Tarea Calificada",
        message: `La tarea "${gradedAssignment.assignments.title}" ha sido calificada con ${score}.`,
        type: "success"
      }));
      await supabaseAdmin.from("notifications").insert(notifications);
    }

    return res.status(200).json({ success: true, message: "Calificación guardada.", assignment: gradedAssignment });

  } catch (error: any) {
    console.error("Error en /api/v1/assignments/grade:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// RÚBRICAS DE EVALUACIÓN
// ==========================================

// GET /api/v1/assignments/:id/rubric
// Lista los criterios de la rúbrica de una tarea (vacío si el docente
// todavía califica con un solo puntaje, como antes)
router.get("/:id/rubric", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("assignment_rubric_criteria")
      .select("*")
      .eq("assignment_id", id)
      .order("sort_order");

    if (error) return res.status(500).json({ error: "Error al consultar la rúbrica." });
    return res.status(200).json({ success: true, criteria: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/assignments/:id/rubric:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/assignments/:id/rubric
// Agrega un criterio a la rúbrica de la tarea (ej. "Contenido" 40pts,
// "Presentación" 20pts, "Ortografía" 10pts...)
router.post("/:id/rubric", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, name, max_points, sort_order } = req.body;

    if (!tenant_id || !name || max_points === undefined) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name, max_points)" });
    }

    const { data: criterion, error } = await supabaseAdmin
      .from("assignment_rubric_criteria")
      .insert({ tenant_id, assignment_id: id, name, max_points: Number(max_points), sort_order: sort_order ?? 0 })
      .select()
      .single();

    if (error || !criterion) return res.status(500).json({ error: "No se pudo agregar el criterio." });
    return res.status(201).json({ success: true, message: "Criterio agregado a la rúbrica.", criterion });
  } catch (error: any) {
    console.error("Error en POST /api/v1/assignments/:id/rubric:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/assignments/rubric/:criterionId
router.delete("/rubric/:criterionId", async (req: Request, res: Response) => {
  try {
    const { criterionId } = req.params;
    const { error } = await supabaseAdmin.from("assignment_rubric_criteria").delete().eq("id", criterionId);
    if (error) return res.status(500).json({ error: "No se pudo eliminar el criterio." });
    return res.status(200).json({ success: true, message: "Criterio eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/assignments/rubric/:criterionId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/assignments/grade-rubric
// Califica una entrega usando la rúbrica: recibe el puntaje por cada
// criterio, los guarda, y el puntaje final de la entrega (score) se
// calcula automáticamente como la suma — el docente no digita un solo
// número, lo arma la matriz de criterios.
router.post("/grade-rubric", async (req: Request, res: Response) => {
  try {
    const { student_assignment_id, teacher_id, feedback, scores } = req.body as {
      student_assignment_id: string; teacher_id: string; feedback?: string; scores: { criterion_id: string; points: number }[];
    };

    if (!student_assignment_id || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (student_assignment_id, scores)" });
    }

    const { data: studentAssignment } = await supabaseAdmin
      .from("student_assignments")
      .select("*, assignments(tenant_id, title)")
      .eq("id", student_assignment_id)
      .single();
    if (!studentAssignment) return res.status(404).json({ error: "Entrega no encontrada." });

    const tenant_id = studentAssignment.assignments.tenant_id;

    await supabaseAdmin
      .from("student_assignment_rubric_scores")
      .upsert(
        scores.map(s => ({ tenant_id, student_assignment_id, criterion_id: s.criterion_id, points: Number(s.points) })),
        { onConflict: "student_assignment_id, criterion_id" }
      );

    const totalScore = scores.reduce((sum, s) => sum + Number(s.points), 0);

    const { data: gradedAssignment, error } = await supabaseAdmin
      .from("student_assignments")
      .update({ status: "graded", score: totalScore, teacher_feedback: feedback || null, graded_at: new Date().toISOString() })
      .eq("id", student_assignment_id)
      .select("*, assignments(title, tenant_id)")
      .single();

    if (error || !gradedAssignment) return res.status(400).json({ error: "No se pudo calificar la tarea." });

    const { data: parents } = await supabaseAdmin
      .from("parent_students")
      .select("parent_id")
      .eq("student_id", gradedAssignment.student_id);

    if (parents) {
      const notifications = parents.map(p => ({
        tenant_id, user_id: p.parent_id, title: "Tarea Calificada",
        message: `La tarea "${gradedAssignment.assignments.title}" ha sido calificada con ${totalScore} (con rúbrica).`,
        type: "success",
      }));
      await supabaseAdmin.from("notifications").insert(notifications);
    }

    return res.status(200).json({ success: true, message: "Calificación por rúbrica guardada.", assignment: gradedAssignment, totalScore });
  } catch (error: any) {
    console.error("Error en POST /api/v1/assignments/grade-rubric:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/assignments/:id/rubric-scores/:studentAssignmentId
// Consulta los puntajes de rúbrica ya guardados para una entrega (para
// precargar el formulario de calificación si ya se calificó antes)
router.get("/:id/rubric-scores/:studentAssignmentId", async (req: Request, res: Response) => {
  try {
    const { studentAssignmentId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("student_assignment_rubric_scores")
      .select("criterion_id, points")
      .eq("student_assignment_id", studentAssignmentId);

    if (error) return res.status(500).json({ error: "Error al consultar los puntajes." });
    return res.status(200).json({ success: true, scores: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/assignments/:id/rubric-scores/:studentAssignmentId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
