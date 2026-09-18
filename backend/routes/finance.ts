import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { createCheckoutSession } from "../services/stripeService";
import { createYappyCheckout } from "../services/yappyService";

const router = Router();

// ==========================================
// TABLA DE CARGOS (Fee Schedules)
// ==========================================

// GET /api/v1/finance/fee-schedules?tenant_id=...
// Lista la tabla de cargos vigente del colegio (usado por Colecturía/Admin)
router.get("/fee-schedules", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("fee_schedules")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("grade")
      .order("concept");

    if (error) return res.status(500).json({ error: "Error al consultar la tabla de cargos." });

    return res.status(200).json({ success: true, feeSchedules: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/finance/fee-schedules:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/finance/fee-schedules
// Crea un cargo recurrente por grado (ej. "Colegiatura Kinder $250/mes")
router.post("/fee-schedules", async (req: Request, res: Response) => {
  try {
    const { tenant_id, grade, concept, description, amount, currency, recurrence, due_day, accounting_code } = req.body;

    if (!tenant_id || !grade || !concept || amount == null) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, grade, concept, amount)" });
    }

    const { data, error } = await supabaseAdmin
      .from("fee_schedules")
      .insert({ tenant_id, grade, concept, description, amount, currency, recurrence, due_day, accounting_code })
      .select()
      .single();

    if (error || !data) {
      console.error("Error al crear cargo:", error);
      return res.status(500).json({ error: "Error al crear el cargo." });
    }

    return res.status(201).json({ success: true, message: "Cargo creado.", feeSchedule: data });
  } catch (error: any) {
    console.error("Error en POST /api/v1/finance/fee-schedules:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/finance/fee-schedules/:id
// Edita o desactiva un cargo existente
router.patch("/fee-schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { grade, concept, description, amount, currency, recurrence, due_day, accounting_code, is_active } = req.body;

    const { data, error } = await supabaseAdmin
      .from("fee_schedules")
      .update({ grade, concept, description, amount, currency, recurrence, due_day, accounting_code, is_active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: "Cargo no encontrado." });

    return res.status(200).json({ success: true, message: "Cargo actualizado.", feeSchedule: data });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/finance/fee-schedules/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/finance/fee-schedules/:id
// Elimina un cargo de la tabla de costos (botón "X" del listado)
router.delete("/fee-schedules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin.from("fee_schedules").delete().eq("id", id);
    if (error) {
      console.error("Error al eliminar cargo:", error);
      return res.status(500).json({ error: "No se pudo eliminar el cargo." });
    }

    return res.status(200).json({ success: true, message: "Cargo eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/finance/fee-schedules/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// BECAS, DESCUENTOS Y CONVENIOS
// ==========================================

// GET /api/v1/finance/student-discounts?tenant_id=...
// Lista todas las becas/descuentos asignados en el colegio (para el
// listado en Admin > Costos > Becas y Descuentos)
router.get("/student-discounts", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("student_discounts")
      .select("*, students(first_name, last_name, grade)")
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar becas y descuentos." });
    return res.status(200).json({ success: true, discounts: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/finance/student-discounts:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/finance/student-discounts
// Asigna una beca/descuento a un alumno (ej. "Beca Deportiva 50%",
// "Descuento Segundo Hermano 10%"). fee_concept es opcional: si se deja
// vacío, el descuento aplica a TODOS los cargos del alumno; si se indica
// (ej. "Colegiatura"), solo aplica a los cargos con ese concepto exacto.
router.post("/student-discounts", async (req: Request, res: Response) => {
  try {
    const { tenant_id, student_id, name, discount_type, value, fee_concept, start_date, end_date, notes, created_by } = req.body;

    if (!tenant_id || !student_id || !name || !discount_type || value === undefined) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, student_id, name, discount_type, value)" });
    }
    if (!["percent", "fixed"].includes(discount_type)) {
      return res.status(400).json({ error: "discount_type debe ser 'percent' o 'fixed'." });
    }
    if (discount_type === "percent" && (Number(value) <= 0 || Number(value) > 100)) {
      return res.status(400).json({ error: "Un descuento porcentual debe estar entre 0 y 100." });
    }

    const { data: discount, error } = await supabaseAdmin
      .from("student_discounts")
      .insert({
        tenant_id, student_id, name, discount_type, value: Number(value),
        fee_concept: fee_concept || null, start_date: start_date || null, end_date: end_date || null,
        notes: notes || null, created_by: created_by || null,
      })
      .select("*, students(first_name, last_name, grade)")
      .single();

    if (error || !discount) {
      console.error("Error al crear beca/descuento:", error);
      return res.status(500).json({ error: "No se pudo registrar la beca/descuento." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "FINANCE",
      description: `Se asignó "${name}" (${discount_type === "percent" ? value + "%" : "$" + value}) al alumno (ID: ${student_id}).`,
      actor_name: "Finance System",
    });

    return res.status(201).json({ success: true, message: "Beca/descuento asignado.", discount });
  } catch (error: any) {
    console.error("Error en POST /api/v1/finance/student-discounts:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/finance/student-discounts/:id
// Activa/desactiva o edita una beca/descuento ya asignado (sin borrar el
// historial: desactivar es preferible a eliminar para conservar el
// registro de qué facturas pasadas la aplicaron)
router.patch("/student-discounts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, discount_type, value, fee_concept, is_active, start_date, end_date, notes } = req.body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (value !== undefined) updates.value = Number(value);
    if (fee_concept !== undefined) updates.fee_concept = fee_concept || null;
    if (is_active !== undefined) updates.is_active = is_active;
    if (start_date !== undefined) updates.start_date = start_date || null;
    if (end_date !== undefined) updates.end_date = end_date || null;
    if (notes !== undefined) updates.notes = notes;

    const { data: discount, error } = await supabaseAdmin
      .from("student_discounts")
      .update(updates)
      .eq("id", id)
      .select("*, students(first_name, last_name, grade)")
      .single();

    if (error || !discount) return res.status(404).json({ error: "Beca/descuento no encontrado." });

    return res.status(200).json({ success: true, message: "Beca/descuento actualizado.", discount });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/finance/student-discounts/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/finance/student-discounts/:id
router.delete("/student-discounts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("student_discounts").delete().eq("id", id);
    if (error) return res.status(500).json({ error: "No se pudo eliminar la beca/descuento." });
    return res.status(200).json({ success: true, message: "Beca/descuento eliminado." });
  } catch (error: any) {
    console.error("Error en DELETE /api/v1/finance/student-discounts/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/finance/generate-invoices
// Genera las facturas del periodo (ej. "2026-09") a partir de la tabla de
// cargos activa: por cada cargo, busca los alumnos matriculados en ese
// grado y les crea una factura (si no se les había generado ya para ese
// mismo cargo+periodo, gracias al índice único de invoices).
router.post("/generate-invoices", async (req: Request, res: Response) => {
  try {
    const { tenant_id, billing_period, due_date } = req.body;
    if (!tenant_id || !billing_period || !due_date) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, billing_period, due_date)" });
    }

    const { data: feeSchedules, error: fsError } = await supabaseAdmin
      .from("fee_schedules")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    if (fsError) return res.status(500).json({ error: "Error al consultar la tabla de cargos." });
    if (!feeSchedules || feeSchedules.length === 0) {
      return res.status(200).json({ success: true, message: "No hay cargos activos configurados.", invoicesCreated: 0 });
    }

    // Becas/descuentos activos del colegio, para no consultarlos alumno por
    // alumno dentro del loop. Un descuento aplica a un cargo si fee_concept
    // es null (aplica a todo) o coincide exacto con el concepto del cargo, y
    // si billing_period cae dentro de su vigencia (start_date/end_date, si
    // se definieron).
    const { data: allDiscounts } = await supabaseAdmin
      .from("student_discounts")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    const periodDate = `${billing_period}-01`;
    const discountsByStudent = new Map<string, typeof allDiscounts>();
    for (const d of allDiscounts || []) {
      if (d.start_date && periodDate < d.start_date) continue;
      if (d.end_date && periodDate > d.end_date) continue;
      if (!discountsByStudent.has(d.student_id)) discountsByStudent.set(d.student_id, []);
      discountsByStudent.get(d.student_id)!.push(d);
    }

    // Aplica los descuentos vigentes de un alumno a un cargo específico:
    // primero se suman los % (capados a 100%) y se aplican sobre el monto
    // original, luego se restan los montos fijos, sin bajar de $0.
    const applyDiscounts = (studentId: string, fee: typeof feeSchedules[number]) => {
      const studentDiscounts = (discountsByStudent.get(studentId) || []).filter(
        d => !d.fee_concept || d.fee_concept.toLowerCase() === fee.concept.toLowerCase()
      );
      if (studentDiscounts.length === 0) return { finalAmount: Number(fee.amount), discountAmount: 0, labels: [] as string[] };

      const percentTotal = Math.min(
        100,
        studentDiscounts.filter(d => d.discount_type === "percent").reduce((sum, d) => sum + Number(d.value), 0)
      );
      const fixedTotal = studentDiscounts.filter(d => d.discount_type === "fixed").reduce((sum, d) => sum + Number(d.value), 0);

      const afterPercent = Number(fee.amount) * (1 - percentTotal / 100);
      const finalAmount = Math.max(0, Number((afterPercent - fixedTotal).toFixed(2)));
      const discountAmount = Number((Number(fee.amount) - finalAmount).toFixed(2));
      const labels = studentDiscounts.map(d => `${d.name} (${d.discount_type === "percent" ? d.value + "%" : "$" + d.value})`);

      return { finalAmount, discountAmount, labels };
    };

    let invoicesCreated = 0;
    const skipped: string[] = [];

    for (const fee of feeSchedules) {
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("id, first_name, last_name, student_academic_records(enrollment_status)")
        .eq("tenant_id", tenant_id)
        .eq("grade", fee.grade);

      for (const student of students || []) {
        const record: any = Array.isArray(student.student_academic_records)
          ? student.student_academic_records[0]
          : student.student_academic_records;
        if (record?.enrollment_status === "withdrawn") continue;

        const { data: guardian } = await supabaseAdmin
          .from("parent_students")
          .select("parent_id")
          .eq("student_id", student.id)
          .limit(1)
          .maybeSingle();

        const invoiceNumber = `FAC-${billing_period}-${Math.floor(10000 + Math.random() * 90000)}`;
        const { finalAmount, discountAmount, labels } = applyDiscounts(student.id, fee);

        const { data: invoice, error: invError } = await supabaseAdmin
          .from("invoices")
          .insert({
            tenant_id,
            student_id: student.id,
            parent_id: guardian?.parent_id || null,
            invoice_number: invoiceNumber,
            amount: finalAmount,
            original_amount: Number(fee.amount),
            discount_amount: discountAmount,
            currency: fee.currency,
            due_date,
            status: "open",
            fee_schedule_id: fee.id,
            billing_period,
          })
          .select()
          .single();

        if (invError || !invoice) {
          // El índice único (student_id, fee_schedule_id, billing_period) rechaza duplicados
          skipped.push(`${student.first_name} ${student.last_name} (${fee.concept})`);
          continue;
        }

        await supabaseAdmin.from("invoice_line_items").insert({
          invoice_id: invoice.id,
          description: `${fee.concept} - ${billing_period}`,
          quantity: 1,
          unit_price: fee.amount,
          accounting_code: fee.accounting_code,
        });

        if (discountAmount > 0) {
          await supabaseAdmin.from("invoice_line_items").insert({
            invoice_id: invoice.id,
            description: `Descuento: ${labels.join(", ")}`,
            quantity: 1,
            unit_price: -discountAmount,
            accounting_code: fee.accounting_code,
          });
        }

        invoicesCreated++;
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SYSTEM",
      description: `Generación de cargos del periodo ${billing_period}: ${invoicesCreated} facturas creadas.`,
      actor_name: "Finance System",
    });

    return res.status(200).json({ success: true, message: "Cargos generados.", invoicesCreated, skipped });
  } catch (error: any) {
    console.error("Error en POST /api/v1/finance/generate-invoices:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/finance/invoices/:student_id
// Lista las facturas de colegiatura de un alumno (usado por el Portal de Padres)
router.get("/invoices/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("*, invoice_line_items(description, quantity, unit_price, discount)")
      .eq("student_id", student_id)
      .order("due_date", { ascending: false });

    if (error) {
      console.error("Error al consultar facturas:", error);
      return res.status(500).json({ error: "Error al consultar las facturas." });
    }

    return res.status(200).json({ success: true, invoices: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/finance/invoices/:student_id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/finance/tuition-block-status/:student_id?tenant_id=...
// Consulta si el Portal de Padres debe bloquear notas/boletines por mora,
// según la política de Control de Morosidad Restrictivo del colegio
// (Admin > Costos). "Meses vencidos" cuenta los periodos de facturación
// (billing_period) distintos con al menos una factura status='open' y
// due_date ya pasada — no cuenta facturas sin billing_period (ej. cargos
// únicos como matrícula) porque esos no representan "meses" de mora.
router.get("/tuition-block-status/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tuition_block_enabled, tuition_block_months_threshold")
      .eq("id", tenant_id)
      .single();

    const enabled = !!tenant?.tuition_block_enabled;
    const threshold = tenant?.tuition_block_months_threshold ?? 2;

    if (!enabled) {
      return res.status(200).json({ success: true, enabled: false, blocked: false, monthsOverdue: 0, threshold });
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: overdueInvoices } = await supabaseAdmin
      .from("invoices")
      .select("billing_period")
      .eq("student_id", student_id)
      .eq("status", "open")
      .lt("due_date", today)
      .not("billing_period", "is", null);

    const monthsOverdue = new Set((overdueInvoices || []).map(inv => inv.billing_period)).size;
    const blocked = monthsOverdue >= threshold;

    return res.status(200).json({ success: true, enabled: true, blocked, monthsOverdue, threshold });
  } catch (error: any) {
    console.error("Error en GET /api/v1/finance/tuition-block-status/:student_id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/finance/payments/:student_id
// Lista los comprobantes de pago (recibos) del alumno, para la pestaña "Comprobantes"
router.get("/payments/:student_id", async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params;

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("id")
      .eq("student_id", student_id);

    const invoiceIds = (invoices || []).map(inv => inv.id);
    if (invoiceIds.length === 0) return res.status(200).json({ success: true, payments: [] });

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*, invoices(invoice_number)")
      .in("invoice_id", invoiceIds)
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("Error al consultar comprobantes de pago:", error);
      return res.status(500).json({ error: "Error al consultar los comprobantes de pago." });
    }

    return res.status(200).json({ success: true, payments: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/finance/payments/:student_id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/finance/tax-summary?tenant_id=...&year=2026
// Impuestos pagados a proveedores (ej. ITBMS) agrupados por mes, para que
// contabilidad los pueda reportar/reclamar en las declaraciones fiscales.
router.get("/tax-summary", async (req: Request, res: Response) => {
  try {
    const { tenant_id, year } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const targetYear = year ? Number(year) : new Date().getFullYear();
    const from = `${targetYear}-01-01`;
    const to = `${targetYear + 1}-01-01`;

    const { data, error } = await supabaseAdmin
      .from("purchase_orders")
      .select("paid_at, subtotal, tax_rate, tax_amount, total_cost, vendors(name)")
      .eq("tenant_id", tenant_id)
      .eq("status", "paid")
      .gte("paid_at", from)
      .lt("paid_at", to)
      .order("paid_at");

    if (error) return res.status(500).json({ error: "Error al consultar los impuestos pagados." });

    const orders = data || [];
    const totalSubtotal = orders.reduce((sum: number, o: any) => sum + Number(o.subtotal || 0), 0);
    const totalTax = orders.reduce((sum: number, o: any) => sum + Number(o.tax_amount || 0), 0);

    const byMonth: Record<string, { subtotal: number; tax: number }> = {};
    for (const o of orders as any[]) {
      if (!o.paid_at) continue;
      const month = String(o.paid_at).slice(0, 7); // "YYYY-MM"
      if (!byMonth[month]) byMonth[month] = { subtotal: 0, tax: 0 };
      byMonth[month].subtotal += Number(o.subtotal || 0);
      byMonth[month].tax += Number(o.tax_amount || 0);
    }

    return res.status(200).json({
      success: true,
      taxSummary: {
        year: targetYear,
        totalSubtotal: Number(totalSubtotal.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        byMonth,
        orders,
      },
    });
  } catch (error: any) {
    console.error("Error en GET /api/v1/finance/tax-summary:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/finance/cashflow?tenant_id=...
// Resumen del flujo financiero del colegio para el Portal de Finanzas:
// ingresos de los alumnos (pagos recibidos + facturas pendientes) vs.
// egresos a staff (nómina) y a proveedores (órdenes de compra/servicios).
router.get("/cashflow", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const [invoicesRes, paymentsRes, paystubsRes, purchaseOrdersRes] = await Promise.all([
      supabaseAdmin.from("invoices").select("amount, status").eq("tenant_id", tenant_id),
      supabaseAdmin
        .from("payments")
        .select("amount_paid, payment_date, method, invoices!inner(tenant_id, invoice_number, student_id, students(first_name, last_name))")
        .eq("invoices.tenant_id", tenant_id)
        .order("payment_date", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("paystubs")
        .select("gross_pay, net_pay, status, payment_date, hr_employees!inner(tenant_id, profiles(first_name, last_name))")
        .eq("hr_employees.tenant_id", tenant_id),
      supabaseAdmin.from("purchase_orders").select("total_cost, status, created_at, vendors(name)").eq("tenant_id", tenant_id),
    ]);

    const invoices = invoicesRes.data || [];
    const payments = paymentsRes.data || [];
    const paystubs = paystubsRes.data || [];
    const purchaseOrders = purchaseOrdersRes.data || [];

    const income = {
      total_received: invoices.filter((i: any) => i.status === "paid").reduce((sum: number, i: any) => sum + Number(i.amount), 0),
      total_pending: invoices.filter((i: any) => i.status === "open").reduce((sum: number, i: any) => sum + Number(i.amount), 0),
    };

    const staffExpenses = {
      total_paid: paystubs.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.net_pay), 0),
      total_pending: paystubs.filter((p: any) => p.status === "pending").reduce((sum: number, p: any) => sum + Number(p.net_pay), 0),
    };

    const vendorExpenses = {
      total_paid: purchaseOrders.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.total_cost), 0),
      total_pending: purchaseOrders
        .filter((p: any) => ["pending_approval", "approved", "scheduled"].includes(p.status))
        .reduce((sum: number, p: any) => sum + Number(p.total_cost), 0),
    };

    const recentIncome = payments.map((p: any) => ({
      type: "income",
      description: `Pago de ${p.invoices?.students ? `${p.invoices.students.first_name} ${p.invoices.students.last_name}` : "alumno"} - Factura ${p.invoices?.invoice_number || ""}`,
      amount: Number(p.amount_paid),
      date: p.payment_date,
    }));

    const recentPaystubs = paystubs
      .filter((p: any) => p.status === "paid" && p.payment_date)
      .map((p: any) => ({
        type: "staff_expense",
        description: `Nómina - ${p.hr_employees?.profiles ? `${p.hr_employees.profiles.first_name} ${p.hr_employees.profiles.last_name}` : "empleado"}`,
        amount: Number(p.net_pay),
        date: p.payment_date,
      }));

    const recentPurchases = purchaseOrders
      .filter((p: any) => p.status === "paid")
      .map((p: any) => ({
        type: "vendor_expense",
        description: `Compra/servicio - ${p.vendors?.name || "proveedor"}`,
        amount: Number(p.total_cost),
        date: p.created_at,
      }));

    const recentTransactions = [...recentIncome, ...recentPaystubs, ...recentPurchases]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    return res.status(200).json({
      success: true,
      cashflow: { income, staffExpenses, vendorExpenses, recentTransactions },
    });
  } catch (error: any) {
    console.error("Error en GET /api/v1/finance/cashflow:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

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
