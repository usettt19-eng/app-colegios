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
    const { tenant_id, class_id, teacher_id, title, description, due_date, max_score } = req.body;

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
        max_score: max_score || 100
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

export default router;
