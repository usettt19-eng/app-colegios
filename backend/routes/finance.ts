import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { createCheckoutSession } from "../services/stripeService";
import { createYappyCheckout } from "../services/yappyService";

const router = Router();

// POST /api/v1/finance/checkout/yappy
// Inicia el flujo de pago a través de Yappy (Banco General Panamá)
router.post("/checkout/yappy", async (req: Request, res: Response) => {
  try {
    const { invoice_id } = req.body;
    if (!invoice_id) return res.status(400).json({ error: "Falta el ID de la factura." });

    const { data: invoice } = await supabaseAdmin.from("invoices").select("*").eq("id", invoice_id).single();
    if (!invoice) return res.status(404).json({ error: "Factura no encontrada." });
    if (invoice.status === "paid") return res.status(400).json({ error: "Esta factura ya está pagada." });

    // Llamamos al servicio de Banco General
    const yappySession = await createYappyCheckout(
      invoice.id, 
      invoice.invoice_number, 
      Number(invoice.amount)
    );

    return res.status(200).json({
      success: true,
      checkout_url: yappySession.url
    });
  } catch (error: any) {
    console.error("Error en checkout Yappy:", error);
    return res.status(500).json({ error: "No se pudo iniciar el pago con Yappy." });
  }
});

// POST /api/v1/finance/checkout
// Inicia el flujo de pago con tarjeta de crédito (Stripe Checkout)
router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { invoice_id } = req.body;

    if (!invoice_id) return res.status(400).json({ error: "Falta el ID de la factura." });

    // 1. Obtener los detalles de la factura
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (!invoice) return res.status(404).json({ error: "Factura no encontrada." });
    if (invoice.status === "paid") return res.status(400).json({ error: "Esta factura ya está pagada." });

    // 2. Crear sesión segura de pago con Tarjeta de Crédito (Stripe)
    const session = await createCheckoutSession(
      invoice.id, 
      invoice.invoice_number, 
      Number(invoice.amount), 
      invoice.currency
    );

    // 3. Devolver la URL del portal de pago al frontend
    return res.status(200).json({
      success: true,
      checkout_url: session.url
    });

  } catch (error: any) {
    console.error("Error en checkout con tarjeta:", error);
    return res.status(500).json({ error: "No se pudo iniciar el pago." });
  }
});

// POST /api/v1/finance/invoice
// Genera una nueva factura (suele llamarse desde un CRON mensual o manualmente por colecturía)
router.post("/invoice", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, parent_id, items, due_date } = req.body;
    // items: array de { description, unit_price, quantity, discount, accounting_code }

    if (!tenant_id || !student_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    const totalAmount = items.reduce((sum, item) => sum + ((item.quantity || 1) * item.unit_price) - (item.discount || 0), 0);
    const invoiceNumber = `FAC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    // 1. Insertar Cabecera de Factura
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        tenant_id,
        student_id,
        parent_id: parent_id || null,
        invoice_number: invoiceNumber,
        amount: totalAmount,
        due_date,
        status: "open"
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      console.error("Error al crear factura:", invoiceError);
      return res.status(500).json({ error: "Error al generar la factura." });
    }

    // 2. Insertar Detalles de Factura (Line Items)
    const lineItems = items.map(item => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity || 1,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      accounting_code: item.accounting_code
    }));

    const { error: lineItemsError } = await supabaseAdmin.from("invoice_line_items").insert(lineItems);

    if (lineItemsError) {
      // En un escenario ideal, aquí haríamos un ROLLBACK de la transacción.
      console.error("Error al insertar detalles de factura:", lineItemsError);
    }

    // 3. Registrar en Auditoría y simular pasarela
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SYSTEM",
      description: `Factura ${invoiceNumber} generada por un valor de $${totalAmount} para el alumno (ID: ${student_id}).`,
      actor_name: "Finance System"
    });

    // Simulamos la respuesta de Stripe/QuickBooks
    const paymentLink = `https://pay.sis-edu.com/checkout/${invoice.id}`;

    return res.status(201).json({
      success: true,
      message: "Factura generada exitosamente.",
      invoice: {
        ...invoice,
        paymentLink
      }
    });

  } catch (error: any) {
    console.error("Error en /api/v1/finance/invoice:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/finance/webhook/stripe
// Webhook para recibir pagos completados desde la pasarela externa
router.post("/webhook/stripe", async (req: Request, res: Response) => {
  try {
    const { invoice_id, amount_paid, transaction_reference } = req.body; 
    // En producción validaríamos la firma criptográfica del webhook de Stripe
    
    // 1. Obtener la factura
    const { data: invoice } = await supabaseAdmin.from("invoices").select("*").eq("id", invoice_id).single();
    if (!invoice) return res.status(404).json({ error: "Factura no encontrada" });

    // 2. Registrar el pago
    await supabaseAdmin.from("payments").insert({
      tenant_id: invoice.tenant_id,
      invoice_id: invoice.id,
      amount_paid,
      method: "stripe",
      transaction_reference
    });

    // 3. Actualizar estado de factura
    await supabaseAdmin.from("invoices").update({ status: "paid" }).eq("id", invoice.id);

    // 4. Enviar notificación In-App al padre agradeciendo el pago
    if (invoice.parent_id) {
      await supabaseAdmin.from("notifications").insert({
        tenant_id: invoice.tenant_id,
        user_id: invoice.parent_id,
        title: "¡Pago Recibido!",
        message: `Hemos recibido tu pago por $${amount_paid} de la factura ${invoice.invoice_number}. ¡Gracias!`,
        type: "success"
      });
    }

    return res.status(200).json({ success: true, message: "Pago aplicado y conciliado." });

  } catch (error: any) {
    console.error("Error en Webhook de Pago:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
