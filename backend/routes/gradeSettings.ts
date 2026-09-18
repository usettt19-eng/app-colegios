import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/grade-settings/levels?tenant_id=...
// Lista los grados del colegio con sus secciones anidadas (para el
// selector Grado -> Sección de Admisiones, y el settings de Admin)
router.get("/levels", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("grade_levels")
      .select("id, name, sort_order, grade_sections(id, name)")
      .eq("tenant_id", tenant_id)
      .order("sort_order");

    if (error) return res.status(500).json({ error: "Error al consultar los grados." });

    return res.status(200).json({ success: true, gradeLevels: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/grade-settings/levels:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/grade-settings/levels
// Crea un nuevo grado (ej. "6to Primaria")
router.post("/levels", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, sort_order } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });

    const { data, error } = await supabaseAdmin
      .from("grade_levels")
      .insert({ tenant_id, name, sort_order: sort_order ?? 0 })
      .select()
      .single();

    if (error || !data) {
      console.error("Error al crear grado:", error);
      return res.status(500).json({ error: "No se pudo crear el grado (¿ya existe uno con ese nombre?)." });
    }

    return res.status(201).json({ success: true, message: "Grado creado.", gradeLevel: data });
  } catch (error: any) {
    console.error("Error en POST /api/v1/grade-settings/levels:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/grade-settings/levels/:id
router.delete("/levels/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("grade_levels").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "No se pudo eliminar el grado." });
    return res.status(200).json({ success: true, message: "Grado eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/grade-settings/levels/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/grade-settings/sections
// Crea una nueva sección dentro de un grado (ej. "5to Primaria" -> "C")
router.post("/sections", async (req: Request, res: Response) => {
  try {
    const { tenant_id, grade_level_id, name } = req.body;
    if (!tenant_id || !grade_level_id || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, grade_level_id, name)" });
    }

    const { data, error } = await supabaseAdmin
      .from("grade_sections")
      .insert({ tenant_id, grade_level_id, name })
      .select()
      .single();

    if (error || !data) {
      console.error("Error al crear sección:", error);
      return res.status(500).json({ error: "No se pudo crear la sección (¿ya existe una con ese nombre en ese grado?)." });
    }

    return res.status(201).json({ success: true, message: "Sección creada.", gradeSection: data });
  } catch (error: any) {
    console.error("Error en POST /api/v1/grade-settings/sections:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/grade-settings/sections/:id
router.delete("/sections/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("grade_sections").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "No se pudo eliminar la sección." });
    return res.status(200).json({ success: true, message: "Sección eliminada." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/grade-settings/sections/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
