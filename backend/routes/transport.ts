import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/transport/buses?tenant_id=...
// Lista los buses del colegio, con el conteo de alumnos asignados a cada uno.
router.get("/buses", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("buses")
      .select("*, students(count)")
      .eq("tenant_id", tenant_id)
      .order("name");

    if (error) return res.status(500).json({ error: "Error al consultar los buses." });

    const buses = (data || []).map((b: any) => ({
      ...b,
      student_count: b.students?.[0]?.count ?? 0,
      students: undefined,
    }));

    return res.status(200).json({ success: true, buses });
  } catch (error: any) {
    console.error("Error en GET /api/v1/transport/buses:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/transport/buses
router.post("/buses", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, plate, driver_name, driver_phone, capacity, route_description } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });

    const { data, error } = await supabaseAdmin
      .from("buses")
      .insert({
        tenant_id, name, plate: plate || null, driver_name: driver_name || null,
        driver_phone: driver_phone || null, capacity: capacity ? Number(capacity) : 30,
        route_description: route_description || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error al crear bus:", error);
      return res.status(500).json({ error: "No se pudo crear el bus." });
    }

    return res.status(201).json({ success: true, message: "Bus creado.", bus: data });
  } catch (error: any) {
    console.error("Error en POST /api/v1/transport/buses:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/transport/buses/:id
router.patch("/buses/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, plate, driver_name, driver_phone, capacity, route_description, is_active } = req.body;

    const { data, error } = await supabaseAdmin
      .from("buses")
      .update({ name, plate, driver_name, driver_phone, capacity, route_description, is_active })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Bus no encontrado." });

    return res.status(200).json({ success: true, message: "Bus actualizado.", bus: data });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/transport/buses/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/transport/buses/:id
router.delete("/buses/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("buses").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "No se pudo eliminar el bus." });
    return res.status(200).json({ success: true, message: "Bus eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/transport/buses/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/transport/buses/:id/roster
// Lista los alumnos asignados a un bus (para el chofer/administración)
router.get("/buses/:id/roster", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, grade, section, photo_url, bus_stop, bus_direction")
      .eq("bus_id", id)
      .order("bus_stop");

    if (error) return res.status(500).json({ error: "Error al consultar los alumnos del bus." });

    return res.status(200).json({ success: true, roster: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/transport/buses/:id/roster:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/transport/assign
// Asigna (o quita, con bus_id null) un alumno a un bus, con su parada y sentido.
router.post("/assign", async (req: Request, res: Response) => {
  try {
    const { student_id, bus_id, bus_stop, bus_direction } = req.body;
    if (!student_id) return res.status(400).json({ error: "Falta student_id" });

    const { data, error } = await supabaseAdmin
      .from("students")
      .update({ bus_id: bus_id || null, bus_stop: bus_stop || null, bus_direction: bus_direction || "ambos" })
      .eq("id", student_id)
      .select("id, first_name, last_name, bus_id, bus_stop, bus_direction")
      .single();

    if (error || !data) return res.status(404).json({ error: "Alumno no encontrado." });

    return res.status(200).json({ success: true, message: bus_id ? "Alumno asignado al bus." : "Alumno desasignado del bus.", student: data });
  } catch (error: any) {
    console.error("Error en POST /api/v1/transport/assign:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
