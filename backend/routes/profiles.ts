import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { uploadProfilePhoto } from "../services/photoStorage";

const router = Router();

// GET /api/v1/profiles?tenant_id=...&role=parent&search=...
// Directorio/buscador de perfiles del colegio (usado para vincular un
// padre existente a un alumno, desde Admisiones o el Directorio de Alumnos)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, role, search } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email, role")
      .eq("tenant_id", tenant_id);

    if (role) query = query.eq("role", role);
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error } = await query.order("first_name").limit(50);
    if (error) return res.status(500).json({ error: "Error al consultar los perfiles." });

    return res.status(200).json({ success: true, profiles: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/profiles:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/profiles
// Crea un perfil nuevo (típicamente un padre/madre/acudiente desde
// Admisiones o el Directorio de Alumnos): da de alta su cuenta real en
// Supabase Auth y su fila en profiles, igual que POST /api/v1/tenants/:id/admins.
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, email, password, first_name, last_name, role, phone } = req.body;

    if (!tenant_id || !email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, email, password, first_name, last_name, role)" });
    }

    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role },
    });

    if (authError || !created?.user) {
      console.error("Error al crear usuario de Auth:", authError);
      return res.status(400).json({ error: authError?.message || "No se pudo crear la cuenta." });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, tenant_id, first_name, last_name, email, role, phone: phone || null })
      .select()
      .single();

    if (profileError || !profile) {
      console.error("Error al crear perfil:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return res.status(500).json({ error: "No se pudo crear el perfil." });
    }

    return res.status(201).json({ success: true, message: "Perfil creado.", profile });
  } catch (error: any) {
    console.error("Error en POST /api/v1/profiles:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

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
