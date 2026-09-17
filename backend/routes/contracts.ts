import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// POST /api/v1/contracts/generate
// Toma una plantilla de la base de datos, reemplaza las variables con los datos del alumno y sube el PDF
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, parent_id, template_id, enrollment_id } = req.body;

    if (!tenant_id || !student_id || !parent_id || !template_id || !enrollment_id) {
      return res.status(400).json({ error: "Parámetros incompletos para generar el contrato." });
    }

    // 1. Obtener la plantilla legal del colegio
    const { data: template } = await supabaseAdmin
      .from("contract_templates")
      .select("html_body, name")
      .eq("id", template_id)
      .single();

    if (!template) {
      return res.status(404).json({ error: "Plantilla de contrato no encontrada." });
    }

    // 2. Obtener los datos reales del Alumno y el Padre
    const { data: student } = await supabaseAdmin.from("students").select("first_name, last_name, grade").eq("id", student_id).single();
    const { data: parent } = await supabaseAdmin.from("profiles").select("first_name, last_name, email").eq("id", parent_id).single();

    if (!student || !parent) {
      return res.status(404).json({ error: "Datos del alumno o tutor no encontrados." });
    }

    // 3. Motor de Plantillas (Reemplazo dinámico de variables)
    // En producción se usaría una librería como Handlebars.js
    let documentHtml = template.html_body;
    documentHtml = documentHtml.replace(/{{student_name}}/g, `${student.first_name} ${student.last_name}`);
    documentHtml = documentHtml.replace(/{{student_grade}}/g, student.grade || "No Asignado");
    documentHtml = documentHtml.replace(/{{parent_name}}/g, `${parent.first_name} ${parent.last_name}`);
    documentHtml = documentHtml.replace(/{{date}}/g, new Date().toLocaleDateString());

    // 4. Generación de PDF y Almacenamiento en Supabase Storage
    // Usualmente usarías puppeteer o pdf-lib para convertir documentHtml a un Buffer de PDF
    const pdfBuffer = Buffer.from(documentHtml); // Simulado como archivo de texto/HTML por ahora
    const fileName = `contratos/${tenant_id}/matricula_${student_id}_${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from("official_documents") // Bucket privado configurado en Supabase
      .upload(fileName, pdfBuffer, { contentType: "application/pdf" });

    if (uploadError) {
      console.error("Error subiendo contrato a Storage:", uploadError);
      return res.status(500).json({ error: "Error al guardar el documento oficial." });
    }

    // Obtener la URL firmada (o pública si aplica)
    const { data: publicUrl } = supabaseAdmin.storage.from("official_documents").getPublicUrl(fileName);

    // 5. Vincular el contrato al expediente (Enrollment)
    await supabaseAdmin
      .from("enrollments")
      .update({ contract_url: publicUrl.publicUrl, status: "pending_signature" })
      .eq("id", enrollment_id);

    // 6. Auditoría
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SECURITY",
      description: `Se generó el contrato de admisión "${template.name}" para el alumno (ID: ${student_id}).`,
      actor_name: "Admissions CRM"
    });

    return res.status(201).json({
      success: true,
      message: "Contrato generado, guardado en la nube y vinculado al expediente.",
      contract_url: publicUrl.publicUrl
    });

  } catch (error: any) {
    console.error("Error en /api/v1/contracts/generate:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
