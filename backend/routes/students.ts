import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { uploadProfilePhoto } from "../services/photoStorage";

const router = Router();

// GET /api/v1/students?tenant_id=...&search=...
// Directorio de alumnos del colegio (para el Portal Administrativo):
// lista todos los alumnos con su grado/sección y los padres vinculados.
router.get("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, search } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, grade, section, photo_url, parent_students(relationship, profiles(id, first_name, last_name, email, role))")
      .eq("tenant_id", tenant_id)
      .order("last_name");

    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "Error al consultar el directorio de alumnos." });

    return res.status(200).json({ success: true, students: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/students:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/students/:id/guardians
// Vincula un padre/madre/acudiente EXISTENTE a un alumno (Directorio de
// Alumnos y Admisiones)
router.post("/:id/guardians", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { parent_id, relationship } = req.body;

    if (!parent_id || !relationship) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (parent_id, relationship)" });
    }

    const { data, error } = await supabaseAdmin
      .from("parent_students")
      .upsert({ student_id: id, parent_id, relationship }, { onConflict: "parent_id, student_id" })
      .select()
      .single();

    if (error || !data) {
      console.error("Error al vincular padre:", error);
      return res.status(500).json({ error: "No se pudo vincular al padre con el alumno." });
    }

    return res.status(201).json({ success: true, message: "Padre vinculado al alumno.", link: data });
  } catch (error: any) {
    console.error("Error en POST /api/v1/students/:id/guardians:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/students/:id/guardians/:parentId
// Desvincula un padre/madre/acudiente de un alumno
router.delete("/:id/guardians/:parentId", async (req: Request, res: Response) => {
  try {
    const { id, parentId } = req.params;

    const { error } = await supabaseAdmin
      .from("parent_students")
      .delete()
      .eq("student_id", id)
      .eq("parent_id", parentId);

    if (error) return res.status(500).json({ error: "No se pudo desvincular al padre." });

    return res.status(200).json({ success: true, message: "Padre desvinculado del alumno." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/students/:id/guardians/:parentId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/students
// Crea el expediente de un alumno de primer ingreso (inicio del proceso de admisión)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, first_name, last_name, grade_section_id, parent_id, relationship, photo_url } = req.body;

    if (!tenant_id || !first_name || !last_name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, first_name, last_name)" });
    }

    // El alumno se asigna a una sección real del colegio (configurada en
    // Admin > Grados y Secciones); grade/section quedan denormalizados en
    // texto porque muchos otros módulos (dashboard, tabla de cargos) los
    // leen así, pero ya no se escriben a mano.
    let grade: string | null = null;
    let section: string | null = null;
    if (grade_section_id) {
      const { data: gradeSection } = await supabaseAdmin
        .from("grade_sections")
        .select("name, grade_levels(name)")
        .eq("id", grade_section_id)
        .single();
      if (gradeSection) {
        section = gradeSection.name;
        grade = (gradeSection as any).grade_levels?.name || null;
      }
    }

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .insert({ tenant_id, first_name, last_name, grade, section, grade_section_id: grade_section_id || null })
      .select()
      .single();

    if (error || !student) {
      console.error("Error al crear alumno:", error);
      return res.status(500).json({ error: "Error al registrar el expediente del alumno." });
    }

    // La foto llega como data URL desde el navegador; se sube a Storage y
    // se guarda la URL pública resultante (no el base64) en photo_url.
    if (photo_url) {
      try {
        const publicUrl = await uploadProfilePhoto(photo_url, tenant_id, "students", student.id);
        await supabaseAdmin.from("students").update({ photo_url: publicUrl }).eq("id", student.id);
        student.photo_url = publicUrl;
      } catch (photoError: any) {
        console.error("Error al subir la foto del alumno:", photoError);
      }
    }

    if (parent_id) {
      await supabaseAdmin.from("parent_students").insert({
        parent_id,
        student_id: student.id,
        relationship: relationship || "acudiente",
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

// POST /api/v1/students/:id/general-info
// Actualiza los datos generales del expediente del alumno
// (cédula, nombres/apellidos desglosados, nacimiento, nacionalidad, religión, escuela de procedencia, etc.)
router.post("/:id/general-info", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      cedula, apellido_paterno, apellido_materno, primer_nombre, segundo_nombre,
      birth_date, gender, nationality, birth_place, religion, baptized,
      previous_school, email, address, grade, section,
    } = req.body;

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .update({
        cedula, apellido_paterno, apellido_materno, primer_nombre, segundo_nombre,
        birth_date, gender, nationality, birth_place, religion, baptized,
        previous_school, email, address, grade, section,
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !student) return res.status(404).json({ error: "Alumno no encontrado." });

    return res.status(200).json({ success: true, message: "Datos generales del alumno actualizados.", student });
  } catch (error: any) {
    console.error("Error en POST /api/v1/students/:id/general-info:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/students/:id/photo
// Sube (o reemplaza) la foto del expediente del alumno al bucket profile_photos
router.post("/:id/photo", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, photo_url } = req.body;

    if (!tenant_id || !photo_url) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, photo_url)" });

    let publicUrl: string;
    try {
      publicUrl = await uploadProfilePhoto(photo_url, tenant_id, "students", id);
    } catch (photoError: any) {
      return res.status(400).json({ error: photoError.message || "No se pudo procesar la foto." });
    }

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .update({ photo_url: publicUrl })
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

// GET /api/v1/students/:id/guardians
// Lista los adultos vinculados al alumno (madre, padre, acudiente, etc.)
// con su perfil completo, para el flujo de "Actualización de Datos"
router.get("/:id/guardians", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("parent_students")
      .select("relationship, profiles(*)")
      .eq("student_id", id);

    if (error) return res.status(500).json({ error: "Error al consultar los responsables del alumno." });

    return res.status(200).json({ success: true, guardians: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/students/:id/guardians:", error);
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

// GET /api/v1/students/:id/dashboard
// Resumen ejecutivo para la pantalla principal del Portal de Padres:
// estado financiero, datos generales, agenda de próximas tareas/exámenes,
// información del periodo activo e índice académico por trimestre.
router.get("/:id/dashboard", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("first_name, last_name, grade, section")
      .eq("id", id)
      .single();

    if (!student) return res.status(404).json({ error: "Alumno no encontrado." });

    // --- Financiero ---
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("amount, status, due_date")
      .eq("student_id", id)
      .neq("status", "paid");

    const balance = (invoices || []).reduce((sum, inv) => sum + Number(inv.amount), 0);
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = (invoices || []).some(inv => inv.status === "open" && inv.due_date < today);

    // --- Ciclo activo, consejero y grupos del alumno ---
    const { data: activeTerm } = await supabaseAdmin
      .from("academic_terms")
      .select("id, name, start_date, end_date")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    const { data: enrollment } = activeTerm
      ? await supabaseAdmin
          .from("enrollments")
          .select("id, class_enrollments(class_id, classes(name, profiles(first_name, last_name)))")
          .eq("student_id", id)
          .eq("term_id", activeTerm.id)
          .maybeSingle()
      : { data: null };

    const classIds: string[] = (enrollment?.class_enrollments || []).map((ce: any) => ce.class_id).filter(Boolean);
    const firstClass: any = (enrollment?.class_enrollments as any)?.[0]?.classes;
    const advisorProfile = Array.isArray(firstClass) ? firstClass[0]?.profiles?.[0] : firstClass?.profiles?.[0];
    const advisorName = advisorProfile ? `${advisorProfile.first_name} ${advisorProfile.last_name}` : null;

    // --- Agenda de tareas/exámenes (semana actual, próxima semana, mes) ---
    const now = new Date();
    const startOfWeek = (d: Date) => { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const curWeekStart = startOfWeek(now);
    const curWeekEnd = new Date(curWeekStart); curWeekEnd.setDate(curWeekEnd.getDate() + 6);
    const nextWeekStart = new Date(curWeekStart); nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const countAssignments = async (from: Date, to: Date) => {
      if (classIds.length === 0) return 0;
      const { count } = await supabaseAdmin
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds)
        .gte("due_date", fmt(from))
        .lte("due_date", fmt(to));
      return count || 0;
    };

    const [currentWeekCount, nextWeekCount, monthCount] = await Promise.all([
      countAssignments(curWeekStart, curWeekEnd),
      countAssignments(nextWeekStart, nextWeekEnd),
      countAssignments(monthStart, monthEnd),
    ]);

    const daysRemaining = activeTerm
      ? Math.max(0, Math.ceil((new Date(activeTerm.end_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : null;

    // --- Índice académico (boletines publicados) ---
    const { data: reportCards } = await supabaseAdmin
      .from("report_cards")
      .select("gpa, academic_terms(name)")
      .eq("student_id", id)
      .eq("is_published", true)
      .order("created_at");

    const byTerm = (reportCards || []).map((rc: any) => ({ term_name: rc.academic_terms?.name || "Periodo", gpa: Number(rc.gpa) }));
    const accumulated = byTerm.length > 0 ? byTerm.reduce((sum, t) => sum + t.gpa, 0) / byTerm.length : null;

    return res.status(200).json({
      success: true,
      dashboard: {
        student: { name: `${student.first_name} ${student.last_name}`, grade: student.grade, section: student.section },
        financial: { balance, status: isOverdue ? "moroso" : "al_dia" },
        general: { term_name: activeTerm?.name || null, advisor_name: advisorName },
        assignments_agenda: {
          current_week: { start: fmt(curWeekStart), end: fmt(curWeekEnd), count: currentWeekCount },
          next_week: { start: fmt(nextWeekStart), end: fmt(nextWeekEnd), count: nextWeekCount },
          month: { start: fmt(monthStart), end: fmt(monthEnd), count: monthCount },
        },
        period: activeTerm ? { name: activeTerm.name, start_date: activeTerm.start_date, end_date: activeTerm.end_date, days_remaining: daysRemaining } : null,
        academic_index: { by_term: byTerm, accumulated },
      },
    });
  } catch (error: any) {
    console.error("Error en GET /api/v1/students/:id/dashboard:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
