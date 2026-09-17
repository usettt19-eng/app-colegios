import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// POST /api/v1/pickup/announce
// El padre (o ruta de bus) anuncia su llegada
router.post("/announce", async (req: Request, res: Response) => {
  try {
    const { tenant_id, parent_id, student_ids, door_id, location_verified } = req.body;

    if (!tenant_id || !parent_id || !student_ids || !Array.isArray(student_ids)) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    const timestamp = new Date().toISOString();
    const insertedEvents = [];

    for (const student_id of student_ids) {
      const { data: event, error: eventError } = await supabaseAdmin
        .from("pickup_events")
        .insert({
          tenant_id,
          parent_id,
          student_id,
          door_id: door_id || null,
          status: "announced",
          location_verified: location_verified !== false,
          announced_at: timestamp,
        })
        .select()
        .single();

      if (eventError) {
        console.error("Error al insertar pickup_event:", eventError);
        continue;
      }

      insertedEvents.push(event);

      await supabaseAdmin.from("audit_logs").insert({
        tenant_id,
        event_type: "PICKUP",
        description: `El padre/tutor (ID: ${parent_id}) anunció su llegada para recoger al alumno (ID: ${student_id}).`,
        actor_name: "Parent App",
        metadata: { pickup_event_id: event.id, location_verified, door_id }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Llegada anunciada para ${insertedEvents.length} alumno(s).`,
      events: insertedEvents
    });

  } catch (error: any) {
    console.error("Error en /api/v1/pickup/announce:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/v1/pickup/release
// El staff autoriza la salida, cambiando el estado y enviando la notificación al padre
router.post("/release", async (req: Request, res: Response) => {
  try {
    const { tenant_id, pickup_event_id, staff_id } = req.body;

    if (!tenant_id || !pickup_event_id || !staff_id) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    const timestamp = new Date().toISOString();

    // 1. Actualizar el estado del evento
    const { data: event, error: updateError } = await supabaseAdmin
      .from("pickup_events")
      .update({
        status: "released",
        verified_at: timestamp
      })
      .eq("id", pickup_event_id)
      .eq("tenant_id", tenant_id)
      .select("*, students(first_name, last_name)")
      .single();

    if (updateError || !event) {
      return res.status(404).json({ error: "Evento de recogida no encontrado o error al actualizar." });
    }

    // 2. Registrar en audit_logs (autorización de salida)
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SECURITY",
      description: `El staff (ID: ${staff_id}) autorizó la salida del alumno (ID: ${event.student_id}).`,
      actor_name: "Staff App", // Se sacaría del token JWT del staff
      metadata: { pickup_event_id: event.id, staff_id }
    });

    // 3. Crear notificación in-app para el padre (dispara el timbre en su app)
    // Supabase Realtime detectará este INSERT y enviará el push a la app del padre
    await supabaseAdmin.from("notifications").insert({
      tenant_id,
      user_id: event.parent_id, // Vinculado a auth.users.id
      title: "Salida Autorizada",
      message: `¡${event.students.first_name} va en camino a tu vehículo! Prepárate para recibirlo.`,
      type: "success",
      pickup_event_id: event.id
    });

    return res.status(200).json({
      success: true,
      message: "Salida autorizada y notificación enviada al padre.",
      event
    });

  } catch (error: any) {
    console.error("Error en /api/v1/pickup/release:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
