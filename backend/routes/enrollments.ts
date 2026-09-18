import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// POST /api/v1/enrollments
// Endpoint real para registrar una matrícula (CRM Admisiones)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, term_id, contract_url, signature_provider } = req.body;

    if (!tenant_id || !student_id || !term_id) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, student_id, term_id)" });
    }

    // 1. Insertar la matrícula en estado 'pending_signature'
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .insert({
        tenant_id,
        student_id,
        term_id,
        contract_url,
        signature_provider,
        status: "pending_signature"
      })
      .select("*, students(first_name, last_name)")
      .single();

    if (enrollmentError) {
      console.error("Error en BD:", enrollmentError);
      return res.status(500).json({ error: "Error al registrar la matrícula." });
    }

    // 2. Registrar el evento en el Audit Log (CRM)
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SYSTEM",
      description: `Se generó un nuevo expediente de matrícula para el estudiante (ID: ${student_id}). Estado: Pendiente de Firma.`,
      actor_name: "CRM System",
      metadata: { enrollment_id: enrollment.id, provider: signature_provider }
    });

    // 3. Simular el envío de un webhook a la pasarela de firma (ej. DocuSign)
    // const signatureResult = await sendToDocuSignAPI(studentInfo, contract_url);

    return res.status(201).json({
      success: true,
      message: "Matrícula procesada exitosamente. Contrato enviado a firma.",
      enrollment
    });

  } catch (error: any) {
    console.error("Error en /api/v1/enrollments:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /api/v1/enrollments/:student_id
// Obtener el historial de matrículas de un alumno
router.get("/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("enrollments")
      .select(`
        *,
        academic_terms (name, start_date, end_date),
        class_enrollments (
          final_grade,
          classes (name, courses(name))
        )
      `)
      .eq("student_id", student_id)
      .order("enrollment_date", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Error al consultar las matrículas" });
    }

    return res.status(200).json({ success: true, enrollments: data });

  } catch (error: any) {
    console.error("Error en GET /api/v1/enrollments:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/enrollments/re-enroll
// Iniciar proceso de reinscripción anual para alumnos existentes
router.post("/re-enroll", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, next_term_id, intent_to_return, update_info } = req.body;

    if (!tenant_id || !student_id || !next_term_id) {
      return res.status(400).json({ error: "Faltan parámetros de reinscripción." });
    }

    if (!intent_to_return) {
      // El padre indicó que el alumno NO regresará el próximo año
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id,
        event_type: "ACADEMIC",
        description: `El padre indicó que el alumno (ID: ${student_id}) NO se reinscribirá para el próximo ciclo.`,
        actor_name: "Admissions CRM"
      });
      return res.status(200).json({ success: true, message: "Decisión de retiro registrada exitosamente." });
    }

    // 1. Crear el expediente (matrícula) para el siguiente año lectivo
    const { data: newEnrollment, error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .insert({
        tenant_id,
        student_id,
        term_id: next_term_id,
        status: "pending_signature" // Queda pendiente de firma del nuevo contrato y pago de matrícula
      })
      .select()
      .single();

    if (enrollmentError) {
      console.error("Error en reinscripción:", enrollmentError);
      // Validar si es error de unicidad (ya está reinscrito)
      if (enrollmentError.code === '23505') {
        return res.status(400).json({ error: "El alumno ya inició un proceso de reinscripción para este ciclo." });
      }
      return res.status(500).json({ error: "Fallo al generar la reinscripción." });
    }

    // 2. Generar Factura de Reinscripción Automáticamente (Ej: Cuota anual de matrícula)
    if (update_info?.enrollment_fee) {
      const invoiceNumber = `REINS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: invoice } = await supabaseAdmin.from("invoices").insert({
        tenant_id,
        student_id,
        invoice_number: invoiceNumber,
        amount: update_info.enrollment_fee,
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 días para pagar
        status: "open"
      }).select().single();

      if (invoice) {
        await supabaseAdmin.from("invoice_line_items").insert({
          invoice_id: invoice.id,
          description: "Cuota de Reinscripción Anual",
          unit_price: update_info.enrollment_fee,
          quantity: 1
        });
      }
    }

    // 3. Auditoría
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "ACADEMIC",
      description: `El alumno (ID: ${student_id}) ha iniciado el proceso de reinscripción anual para el ciclo (ID: ${next_term_id}).`,
      actor_name: "Admissions CRM"
    });

    return res.status(201).json({
      success: true,
      message: "Expediente de reinscripción generado. Pendiente de firma y pago de cuota.",
      enrollment: newEnrollment
    });

  } catch (error) {
    console.error("Error en POST /re-enroll:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
