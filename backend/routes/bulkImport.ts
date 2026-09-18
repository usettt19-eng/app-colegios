import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

interface StudentRow {
  first_name: string;
  last_name: string;
  grade?: string;
  section?: string;
  cedula?: string;
  birth_date?: string;
  family_code?: string;
}

interface ParentRow {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  cedula?: string;
  relationship?: string;
  family_code?: string;
}

// POST /api/v1/bulk-import/students
// Carga masiva de alumnos desde la base de datos de un colegio ya en
// operación (CSV exportado por el sistema anterior). Cada fila trae su
// código de familia, que luego se usa para vincular automáticamente a
// los padres importados con POST /api/v1/bulk-import/parents.
router.post("/students", async (req: Request, res: Response) => {
  try {
    const { tenant_id, rows } = req.body as { tenant_id: string; rows: StudentRow[] };
    if (!tenant_id || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, rows)" });
    }

    const { data: gradeLevels } = await supabaseAdmin
      .from("grade_levels")
      .select("id, name, grade_sections(id, name)")
      .eq("tenant_id", tenant_id);

    const findGradeSectionId = (gradeName?: string, sectionName?: string): string | null => {
      if (!gradeName) return null;
      const level = (gradeLevels || []).find(g => g.name.trim().toLowerCase() === gradeName.trim().toLowerCase());
      if (!level) return null;
      if (!sectionName) return null;
      const section = (level.grade_sections || []).find((s: any) => s.name.trim().toLowerCase() === sectionName.trim().toLowerCase());
      return section?.id || null;
    };

    let created = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.first_name || !row.last_name) {
        errors.push({ row: i + 1, reason: "Falta nombre o apellido." });
        continue;
      }

      const grade_section_id = findGradeSectionId(row.grade, row.section);

      const { error } = await supabaseAdmin.from("students").insert({
        tenant_id,
        first_name: row.first_name,
        last_name: row.last_name,
        grade: row.grade || null,
        section: row.section || null,
        grade_section_id,
        cedula: row.cedula || null,
        birth_date: row.birth_date || null,
        family_code: row.family_code || null,
      });

      if (error) {
        errors.push({ row: i + 1, reason: error.message });
        continue;
      }
      created++;
    }

    return res.status(200).json({ success: true, created, total: rows.length, errors });
  } catch (error: any) {
    console.error("Error en POST /api/v1/bulk-import/students:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/bulk-import/parents
// Carga masiva de padres/madres/acudientes. Por cada fila crea (o
// reutiliza, si el email ya existe) el perfil, y lo vincula automáticamente
// a todos los alumnos del colegio que compartan su mismo código de familia.
router.post("/parents", async (req: Request, res: Response) => {
  try {
    const { tenant_id, rows, default_password } = req.body as { tenant_id: string; rows: ParentRow[]; default_password?: string };
    if (!tenant_id || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, rows)" });
    }

    let created = 0;
    let reused = 0;
    let linked = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.first_name || !row.last_name || !row.email) {
        errors.push({ row: i + 1, reason: "Falta nombre, apellido o email." });
        continue;
      }

      let parentId: string;

      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("email", row.email)
        .maybeSingle();

      if (existing) {
        parentId = existing.id;
        reused++;
        await supabaseAdmin
          .from("profiles")
          .update({ family_code: row.family_code || null, cedula: row.cedula || undefined, phone: row.phone || undefined })
          .eq("id", parentId);
      } else {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: row.email,
          password: default_password || `Cambiar123!`,
          email_confirm: true,
          user_metadata: { first_name: row.first_name, last_name: row.last_name, role: "parent" },
        });

        if (authError || !authUser?.user) {
          errors.push({ row: i + 1, reason: authError?.message || "No se pudo crear la cuenta." });
          continue;
        }

        const { error: profileError } = await supabaseAdmin.from("profiles").insert({
          id: authUser.user.id,
          tenant_id,
          role: "parent",
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone || null,
          cedula: row.cedula || null,
          family_code: row.family_code || null,
        });

        if (profileError) {
          errors.push({ row: i + 1, reason: profileError.message });
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          continue;
        }

        parentId = authUser.user.id;
        created++;
      }

      if (row.family_code) {
        const { data: matchingStudents } = await supabaseAdmin
          .from("students")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("family_code", row.family_code);

        for (const student of matchingStudents || []) {
          await supabaseAdmin
            .from("parent_students")
            .upsert(
              { parent_id: parentId, student_id: student.id, relationship: row.relationship || "acudiente" },
              { onConflict: "parent_id, student_id" }
            );
          linked++;
        }
      }
    }

    return res.status(200).json({ success: true, created, reused, linked, total: rows.length, errors });
  } catch (error: any) {
    console.error("Error en POST /api/v1/bulk-import/parents:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/bulk-import/relink
// Re-escanea alumnos y padres del colegio y vincula (parent_students) a
// todos los que compartan código de familia pero aún no estén vinculados.
// Útil si los archivos se importaron en un orden distinto o por partes.
router.post("/relink", async (req: Request, res: Response) => {
  try {
    const { tenant_id, relationship } = req.body as { tenant_id: string; relationship?: string };
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, family_code")
      .eq("tenant_id", tenant_id)
      .not("family_code", "is", null);

    const { data: parents } = await supabaseAdmin
      .from("profiles")
      .select("id, family_code")
      .eq("tenant_id", tenant_id)
      .eq("role", "parent")
      .not("family_code", "is", null);

    let linked = 0;
    for (const student of students || []) {
      const matchingParents = (parents || []).filter(p => p.family_code === student.family_code);
      for (const parent of matchingParents) {
        const { error } = await supabaseAdmin
          .from("parent_students")
          .upsert(
            { parent_id: parent.id, student_id: student.id, relationship: relationship || "acudiente" },
            { onConflict: "parent_id, student_id", ignoreDuplicates: true }
          );
        if (!error) linked++;
      }
    }

    return res.status(200).json({ success: true, message: "Vinculación por código de familia completada.", linked });
  } catch (error: any) {
    console.error("Error en POST /api/v1/bulk-import/relink:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
