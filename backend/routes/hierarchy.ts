import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/hierarchy/departments?tenant_id=...
// Lista los departamentos académicos/administrativos de un colegio
router.get("/departments", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("*, profiles!departments_head_id_fkey(first_name, last_name)")
      .eq("tenant_id", tenant_id)
      .order("name");

    if (error) return res.status(500).json({ error: "Error al consultar los departamentos." });
    return res.status(200).json({ success: true, departments: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/hierarchy/departments:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/hierarchy/departments
// Crea un departamento (ej. "Ciencias", "Dirección") y opcionalmente asigna a su jefe
router.post("/departments", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, head_id } = req.body;
    if (!tenant_id || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });
    }

    const { data: department, error } = await supabaseAdmin
      .from("departments")
      .insert({ tenant_id, name, head_id: head_id || null })
      .select()
      .single();

    if (error || !department) {
      console.error("Error al crear el departamento:", error);
      return res.status(500).json({ error: "Error al crear el departamento." });
    }

    return res.status(201).json({ success: true, message: "Departamento creado.", department });
  } catch (error: any) {
    console.error("Error en POST /api/v1/hierarchy/departments:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/hierarchy/staff?tenant_id=...
// Lista el staff (perfiles no-padre) con su departamento y a quién le reporta,
// para construir el organigrama del colegio.
router.get("/staff", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, role, department_id, reports_to, departments(name)")
      .eq("tenant_id", tenant_id)
      .neq("role", "parent")
      .order("role");

    if (error) return res.status(500).json({ error: "Error al consultar el staff." });
    return res.status(200).json({ success: true, staff: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/hierarchy/staff:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/hierarchy/staff/:id/assign
// Asigna a un miembro del staff a un departamento y/o a un supervisor directo
router.post("/staff/:id/assign", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { department_id, reports_to } = req.body;

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update({ department_id: department_id ?? null, reports_to: reports_to ?? null })
      .eq("id", id)
      .select()
      .single();

    if (error || !profile) return res.status(404).json({ error: "Perfil de staff no encontrado." });

    return res.status(200).json({ success: true, message: "Estructura jerárquica actualizada.", profile });
  } catch (error: any) {
    console.error("Error en POST /api/v1/hierarchy/staff/:id/assign:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
