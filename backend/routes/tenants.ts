import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

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
router.post("/", async (req: Request, res: Response) => {
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

export default router;
