import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/system/audit-logs?tenant_id=...&event_type=...&limit=50
// Bitácora inmutable de eventos del sistema (panel de auditoría)
router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const { tenant_id, event_type, limit } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin.from("audit_logs").select("*").eq("tenant_id", tenant_id);
    if (event_type) query = query.eq("event_type", event_type);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit ? Number(limit) : 100);

    if (error) return res.status(500).json({ error: "Error al consultar la bitácora de auditoría." });
    return res.status(200).json({ success: true, auditLogs: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/system/audit-logs:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/system/notifications?tenant_id=...&user_id=...
// Notificaciones in-app generadas por el sistema (campana de un usuario, o panel general del colegio)
router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const { tenant_id, user_id, limit } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin.from("notifications").select("*").eq("tenant_id", tenant_id);
    if (user_id) query = query.eq("user_id", user_id);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit ? Number(limit) : 100);

    if (error) return res.status(500).json({ error: "Error al consultar las notificaciones." });
    return res.status(200).json({ success: true, notifications: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/system/notifications:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/system/notifications/:id/read
// Marca una notificación como leída
router.post("/notifications/:id/read", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: notification, error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .select()
      .single();

    if (error || !notification) return res.status(404).json({ error: "Notificación no encontrada." });

    return res.status(200).json({ success: true, notification });
  } catch (error: any) {
    console.error("Error en POST /api/v1/system/notifications/:id/read:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
