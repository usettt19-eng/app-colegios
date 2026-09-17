import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/v1/tenants
// Lista todos los colegios de la plataforma (solo super_admin)
router.get("/", requireAuth, requireRole("super_admin"), async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.from("tenants").select("*").order("name");
    if (error) return res.status(500).json({ error: "Error al consultar los colegios." });
    return res.status(200).json({ success: true, tenants: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/tenants:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/tenants/:id
// Consulta los datos de configuración de un colegio (tenant)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin.from("tenants").select("*").eq("id", id).single();
    if (error || !data) return res.status(404).json({ error: "Colegio no encontrado." });

    return res.status(200).json({ success: true, tenant: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/tenants/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/tenants
// Crea un nuevo colegio (onboarding de una nueva institución en el sistema multi-tenant)
// Solo el super_admin de la plataforma puede dar de alta colegios nuevos.
router.post("/", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const { name, domain, subscription_plan, default_language } = req.body;
    if (!name) return res.status(400).json({ error: "Falta el nombre del colegio." });

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        name,
        domain: domain || null,
        subscription_plan: subscription_plan || "basic",
        default_language: default_language || "es",
      })
      .select()
      .single();

    if (error || !tenant) {
      console.error("Error al crear el colegio:", error);
      return res.status(500).json({ error: "Error al registrar el colegio." });
    }

    return res.status(201).json({ success: true, message: "Colegio registrado en el sistema.", tenant });
  } catch (error: any) {
    console.error("Error en POST /api/v1/tenants:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/tenants/:id/admins
// El super_admin de la plataforma crea el administrador de un colegio:
// da de alta su cuenta real en Supabase Auth (vía Admin API) y su perfil,
// con role='admin' y vinculado a ese tenant.
router.post("/:id/admins", requireAuth, requireRole("super_admin"), async (req: Request, res: Response) => {
  try {
    const { id: tenant_id } = req.params;
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (email, password, first_name, last_name)." });
    }

    const { data: tenant } = await supabaseAdmin.from("tenants").select("id").eq("id", tenant_id).single();
    if (!tenant) return res.status(404).json({ error: "Colegio no encontrado." });

    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role: "admin" },
    });

    if (authError || !created?.user) {
      console.error("Error al crear usuario de Auth:", authError);
      return res.status(400).json({ error: authError?.message || "No se pudo crear la cuenta del administrador." });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, tenant_id, first_name, last_name, email, role: "admin" })
      .select()
      .single();

    if (profileError || !profile) {
      console.error("Error al crear perfil de administrador:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return res.status(500).json({ error: "No se pudo crear el perfil del administrador." });
    }

    return res.status(201).json({ success: true, message: "Administrador del colegio creado.", profile });
  } catch (error: any) {
    console.error("Error en POST /api/v1/tenants/:id/admins:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
