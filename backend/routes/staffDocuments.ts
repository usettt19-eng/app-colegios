import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/staff-documents/:profile_id
// Lista los documentos del expediente de un docente/staff (títulos,
// certificaciones, hoja de vida, experiencia laboral, contrato, etc.)
router.get("/:profile_id", async (req: Request, res: Response) => {
  try {
    const { profile_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("staff_documents")
      .select("*")
      .eq("profile_id", profile_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al consultar documentos de staff:", error);
      return res.status(500).json({ error: "Error al consultar los documentos." });
    }

    return res.status(200).json({ success: true, documents: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/staff-documents/:profile_id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/staff-documents/upload
// El propio docente o el admin adjunta un documento al expediente
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const { tenant_id, profile_id, uploader_id, doc_type, title, file_url } = req.body;

    if (!tenant_id || !profile_id || !doc_type || !file_url) {
      return res.status(400).json({ error: "Faltan parámetros requeridos para el documento." });
    }

    const { data: document, error } = await supabaseAdmin
      .from("staff_documents")
      .insert({
        tenant_id,
        profile_id,
        uploaded_by: uploader_id || null,
        doc_type,
        title,
        file_url,
        status: "pending_review",
      })
      .select()
      .single();

    if (error || !document) {
      console.error("Error al registrar documento de staff:", error);
      return res.status(500).json({ error: "Error al guardar el registro del documento." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SECURITY",
      description: `Se subió un nuevo documento (${doc_type}) al expediente del staff (ID: ${profile_id}).`,
      actor_name: "Admin System",
    });

    return res.status(201).json({
      success: true,
      message: "Documento adjuntado exitosamente al expediente.",
      document,
    });
  } catch (error: any) {
    console.error("Error en POST /api/v1/staff-documents/upload:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/staff-documents/review
// El admin marca un documento del expediente como verificado o rechazado
router.post("/review", async (req: Request, res: Response) => {
  try {
    const { document_id, status, reviewer_comments, reviewer_id } = req.body;
    if (!document_id || !status) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (document_id, status)" });
    }

    const { data: document, error } = await supabaseAdmin
      .from("staff_documents")
      .update({
        status,
        reviewer_comments,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", document_id)
      .select("tenant_id, profile_id, title, doc_type")
      .single();

    if (error || !document) return res.status(404).json({ error: "Documento no encontrado" });

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: document.tenant_id,
      event_type: "SECURITY",
      description: `El staff (ID: ${reviewer_id}) marcó el documento ${document.doc_type} del expediente (perfil ID: ${document.profile_id}) como ${status}.`,
      actor_name: "Admin System",
    });

    return res.status(200).json({ success: true, message: "Revisión completada", document });
  } catch (error: any) {
    console.error("Error en POST /api/v1/staff-documents/review:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
