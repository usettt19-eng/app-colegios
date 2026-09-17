import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// POST /api/v1/bulletins/generate
// Función que calcula promedios y genera el boletín de fin de ciclo para un alumno
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { tenant_id, term_id, student_id, enrollment_id, general_comments } = req.body;

    if (!tenant_id || !term_id || !student_id || !enrollment_id) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    // 1. Obtener todas las calificaciones finales (class_enrollments) del alumno en ese ciclo
    const { data: classesData, error: classesError } = await supabaseAdmin
      .from("class_enrollments")
      .select("class_id, final_grade")
      .eq("enrollment_id", enrollment_id)
      .not("final_grade", "is", null);

    if (classesError || !classesData || classesData.length === 0) {
      return res.status(400).json({ error: "No hay calificaciones registradas para generar el boletín." });
    }

    // 2. Calcular el promedio general (GPA)
    const totalScore = classesData.reduce((acc, curr) => acc + Number(curr.final_grade), 0);
    const gpa = (totalScore / classesData.length).toFixed(2);

    // 3. Crear el Boletín Cabecera
    const { data: reportCard, error: rcError } = await supabaseAdmin
      .from("report_cards")
      .upsert({
        tenant_id,
        enrollment_id,
        student_id,
        term_id,
        gpa,
        general_comments,
        is_published: false // Se publica manualmente después de revisión
      }, { onConflict: "enrollment_id, term_id" })
      .select()
      .single();

    if (rcError) return res.status(500).json({ error: "Fallo al generar cabecera del boletín." });

    // 4. Crear los Detalles del Boletín
    const details = classesData.map(c => ({
      report_card_id: reportCard.id,
      class_id: c.class_id,
      final_score: c.final_grade
    }));

    await supabaseAdmin.from("report_card_details").upsert(details, { onConflict: "report_card_id, class_id" });

    return res.status(201).json({
      success: true,
      message: "Boletín generado en borrador. Listo para revisión.",
      reportCard
    });

  } catch (error) {
    console.error("Error en POST /api/v1/bulletins/generate:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/bulletins/publish
// Publica el boletín y notifica a los padres
router.post("/publish", async (req: Request, res: Response) => {
  try {
    const { report_card_id } = req.body;

    const { data: rc, error } = await supabaseAdmin
      .from("report_cards")
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq("id", report_card_id)
      .select("tenant_id, student_id, term_id, students(first_name)")
      .single();

    if (error || !rc) return res.status(404).json({ error: "Boletín no encontrado" });

    // Notificar a los padres
    const { data: parents } = await supabaseAdmin
      .from("parent_students")
      .select("parent_id")
      .eq("student_id", rc.student_id);

    if (parents) {
      const notifications = parents.map(p => ({
        tenant_id: rc.tenant_id,
        user_id: p.parent_id,
        title: "¡Boletín de Calificaciones Disponible!",
        message: `El boletín final de ${rc.students?.[0]?.first_name} ya está disponible en el portal.`,
        type: "success"
      }));
      await supabaseAdmin.from("notifications").insert(notifications);
    }

    return res.status(200).json({ success: true, message: "Boletín publicado y padres notificados." });
  } catch (error) {
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
