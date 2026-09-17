import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// ==========================================
// INTEGRACIÓN CON SAFESMARTPICKUP (app externa)
// ==========================================
// SafeSmartPickup es la app de logística de recogida que ya opera en producción.
// Este SIS actúa como receptor de webhooks: cuando algo pasa allá (un padre
// anuncia su llegada, un guardia libera a un alumno, etc.), SafeSmartPickup
// notifica a este endpoint para que el SIS refleje el evento (auditoría,
// notificaciones in-app, alertas de deserción, etc.). No hay integración
// saliente (SIS -> SafeSmartPickup) todavía; se agregará cuando se defina
// su contrato de API real.

// Autenticación simple por secreto compartido en el header.
// Configurar SAFESMARTPICKUP_WEBHOOK_SECRET en el .env del SIS y en
// SafeSmartPickup para que ambos coincidan.
function verifyWebhookSecret(req: Request): boolean {
  const expected = process.env.SAFESMARTPICKUP_WEBHOOK_SECRET;
  if (!expected) {
    console.warn("[Webhook SafeSmartPickup] SAFESMARTPICKUP_WEBHOOK_SECRET no está configurado. Rechazando por seguridad.");
    return false;
  }
  const provided = req.header("x-safesmartpickup-secret");
  return provided === expected;
}

// POST /api/v1/webhooks/safesmartpickup
// Payload esperado:
// {
//   "event_type": "pickup.announced" | "pickup.status_changed" | "pickup.completed" | "pickup.cancelled",
//   "tenant_id": "uuid",
//   "student_id": "uuid",
//   "parent_id": "uuid",           // requerido en pickup.announced
//   "door_id": "uuid | null",
//   "status": "in_queue" | "dispatched" | "released" | "completed" | "cancelled", // para pickup.status_changed
//   "pickup_event_id": "uuid",     // id de pickup_events en este SIS; requerido para status_changed/completed/cancelled
//   "external_reference": "string" // id del evento en SafeSmartPickup, para trazabilidad en audit_logs
// }
router.post("/safesmartpickup", async (req: Request, res: Response) => {
  if (!verifyWebhookSecret(req)) {
    return res.status(401).json({ error: "Firma de webhook inválida o ausente." });
  }

  const { event_type, tenant_id, student_id, external_reference } = req.body;

  if (!event_type || !tenant_id) {
    return res.status(400).json({ error: "Faltan parámetros requeridos (event_type, tenant_id)" });
  }

  try {
    switch (event_type) {
      case "pickup.announced": {
        const { parent_id, door_id } = req.body;
        if (!parent_id || !student_id) {
          return res.status(400).json({ error: "pickup.announced requiere parent_id y student_id" });
        }

        const { data: event, error } = await supabaseAdmin
          .from("pickup_events")
          .insert({
            tenant_id,
            parent_id,
            student_id,
            door_id: door_id || null,
            status: "announced",
            location_verified: true,
            announced_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error || !event) {
          console.error("[Webhook SafeSmartPickup] Error al crear pickup_event:", error);
          return res.status(500).json({ error: "Error al registrar el evento de recogida." });
        }

        await supabaseAdmin.from("audit_logs").insert({
          tenant_id,
          event_type: "PICKUP",
          description: `SafeSmartPickup anunció la llegada para el alumno (ID: ${student_id}).`,
          actor_name: "SafeSmartPickup Webhook",
          metadata: { pickup_event_id: event.id, external_reference: external_reference || null },
        });

        // Se devuelve el id del pickup_event del SIS para que SafeSmartPickup
        // lo use en las siguientes llamadas (status_changed / completed / cancelled).
        return res.status(201).json({ success: true, pickup_event_id: event.id });
      }

      case "pickup.status_changed": {
        const { pickup_event_id, status } = req.body;
        if (!pickup_event_id || !status) {
          return res.status(400).json({ error: "pickup.status_changed requiere pickup_event_id y status" });
        }

        const timestamp = new Date().toISOString();
        const updates: Record<string, any> = { status };
        if (status === "released") updates.verified_at = timestamp;
        if (status === "completed") updates.completed_at = timestamp;

        const { data: event, error } = await supabaseAdmin
          .from("pickup_events")
          .update(updates)
          .eq("id", pickup_event_id)
          .eq("tenant_id", tenant_id)
          .select("*, students(first_name)")
          .single();

        if (error || !event) {
          return res.status(404).json({ error: "Evento de recogida no encontrado en el SIS." });
        }

        await supabaseAdmin.from("audit_logs").insert({
          tenant_id,
          event_type: "PICKUP",
          description: `SafeSmartPickup actualizó el evento de recogida (ID: ${pickup_event_id}) a estado "${status}".`,
          actor_name: "SafeSmartPickup Webhook",
          metadata: { pickup_event_id, external_reference: external_reference || null },
        });

        if (status === "released") {
          await supabaseAdmin.from("notifications").insert({
            tenant_id,
            user_id: event.parent_id,
            title: "Salida Autorizada",
            message: `¡${event.students?.[0]?.first_name || "Tu hijo"} va en camino a tu vehículo! Prepárate para recibirlo.`,
            type: "success",
            pickup_event_id: event.id,
          });
        }

        return res.status(200).json({ success: true, event });
      }

      case "pickup.completed":
      case "pickup.cancelled": {
        const { pickup_event_id } = req.body;
        if (!pickup_event_id) {
          return res.status(400).json({ error: `${event_type} requiere pickup_event_id` });
        }

        const status = event_type === "pickup.completed" ? "completed" : "cancelled";
        const updates: Record<string, any> = { status };
        if (status === "completed") updates.completed_at = new Date().toISOString();

        const { data: event, error } = await supabaseAdmin
          .from("pickup_events")
          .update(updates)
          .eq("id", pickup_event_id)
          .eq("tenant_id", tenant_id)
          .select()
          .single();

        if (error || !event) {
          return res.status(404).json({ error: "Evento de recogida no encontrado en el SIS." });
        }

        await supabaseAdmin.from("audit_logs").insert({
          tenant_id,
          event_type: "PICKUP",
          description: `SafeSmartPickup marcó el evento de recogida (ID: ${pickup_event_id}) como "${status}".`,
          actor_name: "SafeSmartPickup Webhook",
          metadata: { pickup_event_id, external_reference: external_reference || null },
        });

        return res.status(200).json({ success: true, event });
      }

      default:
        return res.status(400).json({ error: `event_type "${event_type}" no reconocido.` });
    }
  } catch (error: any) {
    console.error("[Webhook SafeSmartPickup] Error interno:", error);
    return res.status(500).json({ error: "Error interno procesando el webhook." });
  }
});

export default router;
