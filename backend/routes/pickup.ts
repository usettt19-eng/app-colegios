import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// ==========================================
// COLA DE RECOGIDA (vista de guardia/puerta)
// ==========================================

// GET /api/v1/pickup/events?tenant_id=...&status=announced
// Lista los eventos de recogida activos, para la pantalla de garita/guardia
router.get("/events", async (req: Request, res: Response) => {
  try {
    const { tenant_id, status } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin
      .from("pickup_events")
      .select("*, students(first_name, last_name, grade), profiles(first_name, last_name), exit_doors(name)")
      .eq("tenant_id", tenant_id);

    if (status) query = query.eq("status", status);

    const { data, error } = await query.order("announced_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar la cola de recogida." });
    return res.status(200).json({ success: true, events: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/pickup/events:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// PUERTAS DE SALIDA (Exit Doors)
// ==========================================

// GET /api/v1/pickup/doors?tenant_id=...
router.get("/doors", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin.from("exit_doors").select("*").eq("tenant_id", tenant_id).order("name");
    if (error) return res.status(500).json({ error: "Error al consultar las puertas de salida." });
    return res.status(200).json({ success: true, doors: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/pickup/doors:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/pickup/doors
router.post("/doors", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });

    const { data: door, error } = await supabaseAdmin.from("exit_doors").insert({ tenant_id, name }).select().single();
    if (error || !door) {
      console.error("Error al crear la puerta de salida:", error);
      return res.status(500).json({ error: "Error al crear la puerta de salida." });
    }

    return res.status(201).json({ success: true, message: "Puerta de salida creada.", door });
  } catch (error: any) {
    console.error("Error en POST /api/v1/pickup/doors:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// REEMPLAZOS (Autorización de terceros para recoger)
// ==========================================

// GET /api/v1/pickup/replacements?tenant_id=...&parent_id=...
router.get("/replacements", async (req: Request, res: Response) => {
  try {
    const { tenant_id, parent_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin.from("replacement_requests").select("*").eq("tenant_id", tenant_id);
    if (parent_id) query = query.eq("parent_id", parent_id);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Error al consultar los reemplazos." });
    return res.status(200).json({ success: true, replacements: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/pickup/replacements:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/pickup/replacements
// Un padre autoriza a un tercero (recurrente o de un solo día) para recoger a sus hijos
router.post("/replacements", async (req: Request, res: Response) => {
  try {
    const { tenant_id, parent_id, replacement_name, replacement_phone, is_recurring, days_of_week, student_ids, photo_url } = req.body;

    if (!tenant_id || !parent_id || !replacement_name || !replacement_phone || !student_ids || !Array.isArray(student_ids)) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    const { data: replacement, error } = await supabaseAdmin
      .from("replacement_requests")
      .insert({
        tenant_id,
        parent_id,
        replacement_name,
        replacement_phone,
        photo_url: photo_url || null,
        is_recurring: is_recurring !== false,
        days_of_week: days_of_week || null,
        student_ids,
        status: "pending",
      })
      .select()
      .single();

    if (error || !replacement) {
      console.error("Error al crear la solicitud de reemplazo:", error);
      return res.status(500).json({ error: "Error al registrar la solicitud de reemplazo." });
    }

    return res.status(201).json({ success: true, message: "Solicitud de reemplazo enviada, pendiente de aprobación.", replacement });
  } catch (error: any) {
    console.error("Error en POST /api/v1/pickup/replacements:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/pickup/replacements/:id/status
// El colegio aprueba o rechaza la autorización de recogida por un tercero
router.post("/replacements/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' | 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Estado inválido. Usa 'approved' o 'rejected'." });
    }

    const { data: replacement, error } = await supabaseAdmin
      .from("replacement_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !replacement) return res.status(404).json({ error: "Solicitud de reemplazo no encontrada." });

    return res.status(200).json({ success: true, message: `Solicitud marcada como "${status}".`, replacement });
  } catch (error: any) {
    console.error("Error en POST /api/v1/pickup/replacements/:id/status:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// CARPOOL (Autorizaciones recurrentes y excepciones de 1 día)
// ==========================================

// GET /api/v1/pickup/carpool/authorizations?tenant_id=...&student_id=...
router.get("/carpool/authorizations", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin
      .from("carpool_authorizations")
      .select("*, students(first_name, last_name)")
      .eq("tenant_id", tenant_id);
    if (student_id) query = query.eq("student_id", student_id);

    const { data, error } = await query.order("day_of_week");
    if (error) return res.status(500).json({ error: "Error al consultar las autorizaciones de carpool." });
    return res.status(200).json({ success: true, authorizations: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/pickup/carpool/authorizations:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/pickup/carpool/authorizations
// El padre autoriza a otro padre a recoger recurrentemente a su hijo un día específico de la semana
router.post("/carpool/authorizations", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, authorizing_parent_id, driver_parent_id, day_of_week } = req.body;

    if (!tenant_id || !student_id || !authorizing_parent_id || !driver_parent_id || day_of_week === undefined) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    const { data: authorization, error } = await supabaseAdmin
      .from("carpool_authorizations")
      .insert({ tenant_id, student_id, authorizing_parent_id, driver_parent_id, day_of_week })
      .select()
      .single();

    if (error || !authorization) {
      console.error("Error al crear la autorización de carpool:", error);
      return res.status(500).json({ error: "Error al crear la autorización de carpool." });
    }

    return res.status(201).json({ success: true, message: "Autorización de carpool creada.", authorization });
  } catch (error: any) {
    console.error("Error en POST /api/v1/pickup/carpool/authorizations:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/pickup/carpool/overrides?tenant_id=...&student_id=...
router.get("/carpool/overrides", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin
      .from("carpool_overrides")
      .select("*, students(first_name, last_name)")
      .eq("tenant_id", tenant_id);
    if (student_id) query = query.eq("student_id", student_id);

    const { data, error } = await query.order("override_date", { ascending: false });
    if (error) return res.status(500).json({ error: "Error al consultar las excepciones de carpool." });
    return res.status(200).json({ success: true, overrides: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/pickup/carpool/overrides:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/pickup/carpool/overrides
// Excepción de un solo día: alguien distinto al carpool recurrente recogerá al alumno
router.post("/carpool/overrides", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, authorizing_parent_id, driver_parent_id, override_date, created_by } = req.body;

    if (!tenant_id || !student_id || !authorizing_parent_id || !driver_parent_id || !override_date) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    const { data: override, error } = await supabaseAdmin
      .from("carpool_overrides")
      .insert({ tenant_id, student_id, authorizing_parent_id, driver_parent_id, override_date, created_by: created_by || null })
      .select()
      .single();

    if (error || !override) {
      console.error("Error al crear la excepción de carpool:", error);
      return res.status(500).json({ error: "Error al crear la excepción de carpool." });
    }

    return res.status(201).json({ success: true, message: "Excepción de carpool registrada para ese día.", override });
  } catch (error: any) {
    console.error("Error en POST /api/v1/pickup/carpool/overrides:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

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
