import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/profiles/:id
// Consulta el perfil básico de un padre/staff (usado para mostrar su foto y datos generales)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, role, email, phone, photo_url")
      .eq("id", id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Perfil no encontrado." });

    return res.status(200).json({ success: true, profile: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/profiles/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/profiles/:id/photo
// Actualiza la foto de un padre/staff en su expediente
router.post("/:id/photo", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { photo_url } = req.body;

    if (!photo_url) return res.status(400).json({ error: "Falta photo_url" });

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update({ photo_url })
      .eq("id", id)
      .select()
      .single();

    if (error || !profile) return res.status(404).json({ error: "Perfil no encontrado." });

    return res.status(200).json({ success: true, message: "Foto de perfil actualizada.", profile });
  } catch (error: any) {
    console.error("Error en POST /api/v1/profiles/:id/photo:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
