import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { uploadDocumentFile, getSignedDocumentUrl } from "../services/documentStorage";

const router = Router();

// GET /api/v1/documents/:student_id
// Lista los documentos del expediente de un alumno (usado por Admisiones y el Portal de Padres)
router.get("/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("student_documents")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al consultar documentos:", error);
      return res.status(500).json({ error: "Error al consultar los documentos." });
    }

    // La URL firmada (temporal, 1h) es la única forma de ver/descargar el
    // archivo real del bucket privado "documents"; file_url guarda solo la
    // ruta interna. Viene null si es un registro viejo sin archivo real.
    const documents = await Promise.all(
      (data || []).map(async doc => ({ ...doc, download_url: await getSignedDocumentUrl(doc.file_url) }))
    );

    return res.status(200).json({ success: true, documents });
  } catch (error: any) {
    console.error("Error en GET /api/v1/documents/:student_id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/documents/upload
// Endpoint para que los padres o secretaria suban los documentos requeridos
// (ej. notas colegio anterior). file_data es el archivo como data URL
// ("data:<mime>;base64,..."), se sube al bucket privado "documents" y se
// guarda su ruta interna en file_url.
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, uploader_id, doc_type, title, file_data, file_name } = req.body;

    if (!tenant_id || !student_id || !doc_type || !file_data) {
      return res.status(400).json({ error: "Faltan parámetros requeridos para el documento." });
    }

    let file_url: string;
    try {
      file_url = await uploadDocumentFile(file_data, tenant_id, "students", student_id, file_name || "documento");
    } catch (uploadError: any) {
      return res.status(400).json({ error: uploadError.message || "No se pudo subir el archivo." });
    }

    const { data: document, error } = await supabaseAdmin
      .from("student_documents")
      .insert({
        tenant_id,
        student_id,
        uploaded_by: uploader_id,
        doc_type,
        title,
        file_url,
        status: "pending_review" // Queda a la espera de que secretaría lo revise
      })
      .select()
      .single();

    if (error || !document) {
      console.error("Error al registrar documento:", error);
      return res.status(500).json({ error: "Error al guardar el registro del documento." });
    }

    // Auditoría de ingreso de documentos sensibles
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SECURITY",
      description: `Se subió un nuevo documento (${doc_type}) al expediente del estudiante (ID: ${student_id}).`,
      actor_name: "Admissions CRM"
    });

    return res.status(201).json({
      success: true,
      message: "Documento adjuntado exitosamente al expediente. En espera de revisión.",
      document
    });
  } catch (error: any) {
    console.error("Error en /api/v1/documents/upload:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/documents/review
// Endpoint para que el departamento de admisiones apruebe o rechace el documento
router.post("/review", async (req: Request, res: Response) => {
  try {
    const { document_id, status, reviewer_comments, reviewer_id } = req.body;

    const { data: document, error } = await supabaseAdmin
      .from("student_documents")
      .update({
        status, // 'approved' o 'rejected'
        reviewer_comments,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", document_id)
      .select("tenant_id, student_id, title, doc_type")
      .single();

    if (error || !document) return res.status(404).json({ error: "Documento no encontrado" });

    // Notificar al padre sobre la decisión (Supabase Realtime)
    const { data: parents } = await supabaseAdmin
      .from("parent_students")
      .select("parent_id")
      .eq("student_id", document.student_id);

    if (parents) {
      const isApproved = status === "approved";
      const notifications = parents.map(p => ({
        tenant_id: document.tenant_id,
        user_id: p.parent_id,
        title: isApproved ? "Documento Aprobado" : "Documento Rechazado",
        message: isApproved 
          ? `El documento "${document.title}" ha sido verificado y aprobado por secretaría.`
          : `El documento "${document.title}" fue rechazado. Razón: ${reviewer_comments}`,
        type: isApproved ? "success" : "error"
      }));
      await supabaseAdmin.from("notifications").insert(notifications);
    }

    // Registrar en auditoría la aprobación oficial (crucial para compliance legal de traslados)
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: document.tenant_id,
      event_type: "SECURITY",
      description: `El staff (ID: ${reviewer_id}) marcó el documento ${document.doc_type} como ${status}.`,
      actor_name: "Admissions Staff"
    });

    return res.status(200).json({ success: true, message: "Revisión completada", document });
  } catch (error) {
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
