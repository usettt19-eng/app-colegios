import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// ==========================================
// CICLOS DE EVALUACIÓN
// ==========================================

// GET /api/v1/teacher-evaluations/cycles?tenant_id=...
router.get("/cycles", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("teacher_evaluation_cycles")
      .select("*, academic_terms(name)")
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar los ciclos de evaluación." });
    return res.status(200).json({ success: true, cycles: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/teacher-evaluations/cycles:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/teacher-evaluations/cycles
router.post("/cycles", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, term_id } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });

    const { data: cycle, error } = await supabaseAdmin
      .from("teacher_evaluation_cycles")
      .insert({ tenant_id, name, term_id: term_id || null })
      .select("*, academic_terms(name)")
      .single();

    if (error || !cycle) return res.status(500).json({ error: "No se pudo crear el ciclo de evaluación." });
    return res.status(201).json({ success: true, message: "Ciclo de evaluación creado.", cycle });
  } catch (error: any) {
    console.error("Error en POST /api/v1/teacher-evaluations/cycles:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/teacher-evaluations/cycles/:id
// Abre/cierra el ciclo (cerrarlo evita que se sigan registrando evaluaciones)
router.patch("/cycles/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_open } = req.body;
    if (is_open === undefined) return res.status(400).json({ error: "Falta is_open" });

    const { data: cycle, error } = await supabaseAdmin
      .from("teacher_evaluation_cycles")
      .update({ is_open })
      .eq("id", id)
      .select("*, academic_terms(name)")
      .single();

    if (error || !cycle) return res.status(404).json({ error: "Ciclo no encontrado." });
    return res.status(200).json({ success: true, message: "Ciclo actualizado.", cycle });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/teacher-evaluations/cycles/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// EVALUACIONES
// ==========================================

// POST /api/v1/teacher-evaluations/evaluations
// Registra una evaluación de un docente (de Coordinación, o de un alumno
// vía su padre en el Portal de Padres). Escala 1-5 por dimensión.
router.post("/evaluations", async (req: Request, res: Response) => {
  try {
    const {
      tenant_id, cycle_id, teacher_id, evaluator_role, evaluator_student_id, evaluator_profile_id, class_id,
      score_teaching, score_punctuality, score_communication, score_fairness, comments,
    } = req.body;

    if (!tenant_id || !cycle_id || !teacher_id || !evaluator_role) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, cycle_id, teacher_id, evaluator_role)" });
    }
    if (!["student", "coordination"].includes(evaluator_role)) {
      return res.status(400).json({ error: "evaluator_role debe ser 'student' o 'coordination'." });
    }

    const { data: cycle } = await supabaseAdmin.from("teacher_evaluation_cycles").select("is_open").eq("id", cycle_id).single();
    if (!cycle || !cycle.is_open) {
      return res.status(400).json({ error: "Este ciclo de evaluación ya está cerrado." });
    }

    const { data: evaluation, error } = await supabaseAdmin
      .from("teacher_evaluations")
      .insert({
        tenant_id, cycle_id, teacher_id, evaluator_role,
        evaluator_student_id: evaluator_student_id || null, evaluator_profile_id: evaluator_profile_id || null,
        class_id: class_id || null,
        score_teaching: score_teaching ?? null, score_punctuality: score_punctuality ?? null,
        score_communication: score_communication ?? null, score_fairness: score_fairness ?? null,
        comments: comments || null,
      })
      .select()
      .single();

    if (error || !evaluation) {
      console.error("Error al registrar evaluación docente:", error);
      return res.status(500).json({ error: "No se pudo registrar la evaluación." });
    }

    return res.status(201).json({ success: true, message: "Evaluación registrada.", evaluation });
  } catch (error: any) {
    console.error("Error en POST /api/v1/teacher-evaluations/evaluations:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/teacher-evaluations/summary?tenant_id=...&cycle_id=...
// Puntaje promedio de desempeño por docente en un ciclo (para RRHH),
// desglosado por quién evaluó (alumnos vs. coordinación).
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const { tenant_id, cycle_id } = req.query;
    if (!tenant_id || !cycle_id) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, cycle_id)" });

    const { data: evaluations, error } = await supabaseAdmin
      .from("teacher_evaluations")
      .select("teacher_id, evaluator_role, score_teaching, score_punctuality, score_communication, score_fairness, profiles!teacher_evaluations_teacher_id_fkey(first_name, last_name)")
      .eq("tenant_id", tenant_id)
      .eq("cycle_id", cycle_id);

    if (error) {
      console.error("Error al consultar resumen de evaluaciones:", error);
      return res.status(500).json({ error: "Error al consultar el resumen." });
    }

    const overallScore = (e: any) => {
      const scores = [e.score_teaching, e.score_punctuality, e.score_communication, e.score_fairness].filter((s: any) => s !== null && s !== undefined);
      if (scores.length === 0) return null;
      return scores.reduce((sum: number, s: number) => sum + Number(s), 0) / scores.length;
    };

    const byTeacher = new Map<string, { teacher_name: string; studentScores: number[]; coordinationScores: number[] }>();
    for (const ev of evaluations || []) {
      const teacherName = (ev as any).profiles ? `${(ev as any).profiles.first_name} ${(ev as any).profiles.last_name}` : "Docente";
      if (!byTeacher.has(ev.teacher_id)) byTeacher.set(ev.teacher_id, { teacher_name: teacherName, studentScores: [], coordinationScores: [] });
      const score = overallScore(ev);
      if (score === null) continue;
      if (ev.evaluator_role === "student") byTeacher.get(ev.teacher_id)!.studentScores.push(score);
      else byTeacher.get(ev.teacher_id)!.coordinationScores.push(score);
    }

    const avg = (arr: number[]) => (arr.length > 0 ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)) : null);

    const summary = Array.from(byTeacher.entries()).map(([teacher_id, v]) => {
      const studentAvg = avg(v.studentScores);
      const coordinationAvg = avg(v.coordinationScores);
      const allScores = [...v.studentScores, ...v.coordinationScores];
      return {
        teacher_id,
        teacher_name: v.teacher_name,
        student_average: studentAvg,
        student_responses: v.studentScores.length,
        coordination_average: coordinationAvg,
        coordination_responses: v.coordinationScores.length,
        overall_average: avg(allScores),
      };
    });

    return res.status(200).json({ success: true, summary });
  } catch (error: any) {
    console.error("Error en GET /api/v1/teacher-evaluations/summary:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
