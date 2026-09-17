import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// ==========================================
// SALUD (campos directos en students)
// ==========================================

// POST /api/v1/student-record/:id/health
router.post("/:id/health", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      blood_type, height_cm, weight_lbs, primary_doctor, clinic_name, clinic_phone,
      takes_medication, needs_assistance, allergies, medical_conditions,
      vaccines_updated, allowed_medications, allowed_medications_other,
    } = req.body;

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .update({
        blood_type, height_cm, weight_lbs, primary_doctor, clinic_name, clinic_phone,
        takes_medication, needs_assistance, allergies, medical_conditions,
        vaccines_updated, allowed_medications, allowed_medications_other,
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !student) return res.status(404).json({ error: "Alumno no encontrado." });

    return res.status(200).json({ success: true, message: "Información de salud actualizada.", student });
  } catch (error: any) {
    console.error("Error en POST /api/v1/student-record/:id/health:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// CONTACTOS DE EMERGENCIA
// ==========================================

// GET /api/v1/student-record/:id/emergency-contacts
router.get("/:id/emergency-contacts", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("student_emergency_contacts")
      .select("*")
      .eq("student_id", id)
      .order("created_at");

    if (error) return res.status(500).json({ error: "Error al consultar los contactos de emergencia." });
    return res.status(200).json({ success: true, contacts: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/student-record/:id/emergency-contacts:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/student-record/:id/emergency-contacts
router.post("/:id/emergency-contacts", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, name, cedula, relationship, phone } = req.body;

    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });

    const { data: contact, error } = await supabaseAdmin
      .from("student_emergency_contacts")
      .insert({ tenant_id, student_id: id, name, cedula, relationship, phone })
      .select()
      .single();

    if (error || !contact) return res.status(500).json({ error: "Error al registrar el contacto." });

    return res.status(201).json({ success: true, message: "Contacto de emergencia agregado.", contact });
  } catch (error: any) {
    console.error("Error en POST /api/v1/student-record/:id/emergency-contacts:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/student-record/emergency-contacts/:contactId
router.delete("/emergency-contacts/:contactId", async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const { error } = await supabaseAdmin.from("student_emergency_contacts").delete().eq("id", contactId);
    if (error) return res.status(500).json({ error: "Error al eliminar el contacto." });
    return res.status(200).json({ success: true, message: "Contacto eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/student-record/emergency-contacts/:contactId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// AUTORIZADOS A RETIRAR ESTUDIANTE
// ==========================================

// GET /api/v1/student-record/:id/authorized-pickups
router.get("/:id/authorized-pickups", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("student_authorized_pickups")
      .select("*")
      .eq("student_id", id)
      .order("created_at");

    if (error) return res.status(500).json({ error: "Error al consultar los autorizados a retirar." });
    return res.status(200).json({ success: true, authorizedPickups: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/student-record/:id/authorized-pickups:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/student-record/:id/authorized-pickups
router.post("/:id/authorized-pickups", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, name, cedula, relationship, phone } = req.body;

    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });

    const { data: authorizedPickup, error } = await supabaseAdmin
      .from("student_authorized_pickups")
      .insert({ tenant_id, student_id: id, name, cedula, relationship, phone })
      .select()
      .single();

    if (error || !authorizedPickup) return res.status(500).json({ error: "Error al registrar el autorizado." });

    return res.status(201).json({ success: true, message: "Persona autorizada agregada.", authorizedPickup });
  } catch (error: any) {
    console.error("Error en POST /api/v1/student-record/:id/authorized-pickups:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/student-record/authorized-pickups/:pickupId
router.delete("/authorized-pickups/:pickupId", async (req: Request, res: Response) => {
  try {
    const { pickupId } = req.params;
    const { error } = await supabaseAdmin.from("student_authorized_pickups").delete().eq("id", pickupId);
    if (error) return res.status(500).json({ error: "Error al eliminar el autorizado." });
    return res.status(200).json({ success: true, message: "Autorizado eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/student-record/authorized-pickups/:pickupId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// VACUNAS
// ==========================================

// GET /api/v1/student-record/:id/vaccines
router.get("/:id/vaccines", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("student_vaccines")
      .select("*")
      .eq("student_id", id)
      .order("date", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar las vacunas." });
    return res.status(200).json({ success: true, vaccines: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/student-record/:id/vaccines:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/student-record/:id/vaccines
router.post("/:id/vaccines", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, vaccine_name, dose, date } = req.body;

    if (!tenant_id || !vaccine_name) return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, vaccine_name)" });

    const { data: vaccine, error } = await supabaseAdmin
      .from("student_vaccines")
      .insert({ tenant_id, student_id: id, vaccine_name, dose, date: date || null })
      .select()
      .single();

    if (error || !vaccine) return res.status(500).json({ error: "Error al registrar la vacuna." });

    return res.status(201).json({ success: true, message: "Vacuna registrada.", vaccine });
  } catch (error: any) {
    console.error("Error en POST /api/v1/student-record/:id/vaccines:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/student-record/vaccines/:vaccineId
router.delete("/vaccines/:vaccineId", async (req: Request, res: Response) => {
  try {
    const { vaccineId } = req.params;
    const { error } = await supabaseAdmin.from("student_vaccines").delete().eq("id", vaccineId);
    if (error) return res.status(500).json({ error: "Error al eliminar la vacuna." });
    return res.status(200).json({ success: true, message: "Vacuna eliminada." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/student-record/vaccines/:vaccineId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
