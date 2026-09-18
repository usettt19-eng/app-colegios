import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/facilities?tenant_id=...
// Catálogo de espacios reservables del colegio (auditorio, laboratorio,
// sala de cómputo, etc.)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("facilities")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("name");

    if (error) return res.status(500).json({ error: "Error al consultar los espacios." });
    return res.status(200).json({ success: true, facilities: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/facilities:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/facilities
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, category, capacity } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });

    const { data: facility, error } = await supabaseAdmin
      .from("facilities")
      .insert({ tenant_id, name, category: category || null, capacity: capacity || null })
      .select()
      .single();

    if (error || !facility) return res.status(500).json({ error: "No se pudo crear el espacio." });
    return res.status(201).json({ success: true, message: "Espacio creado.", facility });
  } catch (error: any) {
    console.error("Error en POST /api/v1/facilities:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/facilities/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("facilities").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "No se pudo eliminar el espacio." });
    return res.status(200).json({ success: true, message: "Espacio eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/facilities/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/facilities/bookings?tenant_id=...&date=...
// Lista las reservas (todas, o filtradas por fecha para ver la agenda de un día)
router.get("/bookings", async (req: Request, res: Response) => {
  try {
    const { tenant_id, date } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    let query = supabaseAdmin
      .from("facility_bookings")
      .select("*, facilities(name, category), profiles(first_name, last_name)")
      .eq("tenant_id", tenant_id);

    if (date) query = query.eq("date", date);

    const { data, error } = await query.order("date").order("start_time");

    if (error) return res.status(500).json({ error: "Error al consultar las reservas." });
    return res.status(200).json({ success: true, bookings: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/facilities/bookings:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/facilities/bookings
// Reserva un espacio en un horario. Valida que no se cruce con otra
// reserva ya confirmada del mismo espacio ese día (conflicto de horario).
router.post("/bookings", async (req: Request, res: Response) => {
  try {
    const { tenant_id, facility_id, booked_by, date, start_time, end_time, purpose } = req.body;

    if (!tenant_id || !facility_id || !booked_by || !date || !start_time || !end_time) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, facility_id, booked_by, date, start_time, end_time)" });
    }
    if (end_time <= start_time) {
      return res.status(400).json({ error: "La hora de fin debe ser posterior a la hora de inicio." });
    }

    const { data: existing } = await supabaseAdmin
      .from("facility_bookings")
      .select("start_time, end_time")
      .eq("facility_id", facility_id)
      .eq("date", date);

    const overlaps = (existing || []).some(b => start_time < b.end_time && end_time > b.start_time);
    if (overlaps) {
      return res.status(400).json({ error: "Ese espacio ya está reservado en un horario que se cruza con el solicitado." });
    }

    const { data: booking, error } = await supabaseAdmin
      .from("facility_bookings")
      .insert({ tenant_id, facility_id, booked_by, date, start_time, end_time, purpose: purpose || null })
      .select("*, facilities(name, category), profiles(first_name, last_name)")
      .single();

    if (error || !booking) return res.status(500).json({ error: "No se pudo crear la reserva." });
    return res.status(201).json({ success: true, message: "Espacio reservado.", booking });
  } catch (error: any) {
    console.error("Error en POST /api/v1/facilities/bookings:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/facilities/bookings/:id
router.delete("/bookings/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("facility_bookings").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "No se pudo cancelar la reserva." });
    return res.status(200).json({ success: true, message: "Reserva cancelada." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/facilities/bookings/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
