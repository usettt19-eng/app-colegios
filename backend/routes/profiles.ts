import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { uploadProfilePhoto } from "../services/photoStorage";

const router = Router();

// GET /api/v1/profiles/:id
// Consulta el perfil básico de un padre/staff (usado para mostrar su foto y datos generales)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, role, email, phone, photo_url, cedula, office_phone, mobile_phone, nationality, profession, workplace, address")
      .eq("id", id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Perfil no encontrado." });

    return res.status(200).json({ success: true, profile: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/profiles/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/profiles/:id/general-info
// Actualiza la información general del expediente de un padre/staff
// (cédula, teléfonos, nacionalidad, profesión, lugar de trabajo, dirección)
router.post("/:id/general-info", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      first_name, last_name, cedula, phone, office_phone, mobile_phone,
      nationality, email, profession, workplace, address,
    } = req.body;

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name, last_name, cedula, phone, office_phone, mobile_phone,
        nationality, email, profession, workplace, address,
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !profile) return res.status(404).json({ error: "Perfil no encontrado." });

    return res.status(200).json({ success: true, message: "Información general actualizada.", profile });
  } catch (error: any) {
    console.error("Error en POST /api/v1/profiles/:id/general-info:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/profiles/:id/photo
// Sube (o reemplaza) la foto de un padre/staff al bucket profile_photos
router.post("/:id/photo", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, photo_url } = req.body;

    if (!tenant_id || !photo_url) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, photo_url)" });

    let publicUrl: string;
    try {
      publicUrl = await uploadProfilePhoto(photo_url, tenant_id, "profiles", id);
    } catch (photoError: any) {
      return res.status(400).json({ error: photoError.message || "No se pudo procesar la foto." });
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update({ photo_url: publicUrl })
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
