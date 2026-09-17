import { Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { AuthedRequest, requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/v1/auth/me
// Devuelve el perfil autenticado (vía Supabase Auth) y, si es un padre,
// los hijos vinculados a él (parent_students), para que el frontend deje
// de depender de IDs de demostración fijos.
router.get("/me", requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const profile = req.authProfile!;
    let children: any[] = [];

    if (profile.role === "parent") {
      const { data, error } = await supabaseAdmin
        .from("parent_students")
        .select("relationship, students(id, first_name, last_name, grade, section, photo_url)")
        .eq("parent_id", profile.id);

      if (error) return res.status(500).json({ error: "Error al consultar los hijos vinculados." });

      children = (data || [])
        .map((row: any) => (row.students ? { ...row.students, relationship: row.relationship } : null))
        .filter(Boolean);
    }

    return res.status(200).json({ success: true, profile, children });
  } catch (error: any) {
    console.error("Error en GET /api/v1/auth/me:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
