import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { uploadDocumentFile, getSignedDocumentUrl } from "../services/documentStorage";

const router = Router();

// ==========================================
// MÓDULO DE PROVEEDORES Y CUENTAS POR PAGAR
// ==========================================

// GET /api/v1/corporate/vendors?tenant_id=...
router.get("/vendors", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("name");

    if (error) return res.status(500).json({ error: "Error al consultar los proveedores." });
    return res.status(200).json({ success: true, vendors: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/vendors:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/vendors
router.post("/vendors", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, contact_email, tax_id, service_type } = req.body;
    if (!tenant_id || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name)" });
    }

    const { data: vendor, error } = await supabaseAdmin
      .from("vendors")
      .insert({ tenant_id, name, contact_email, tax_id, service_type })
      .select()
      .single();

    if (error || !vendor) {
      console.error("Error al crear proveedor:", error);
      return res.status(500).json({ error: "Error al registrar el proveedor." });
    }

    return res.status(201).json({ success: true, message: "Proveedor registrado.", vendor });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/vendors:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/corporate/purchase-orders?tenant_id=...
router.get("/purchase-orders", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("purchase_orders")
      .select("*, vendors(name, service_type), profiles(first_name, last_name)")
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar las órdenes de compra." });

    const purchaseOrders = await Promise.all(
      (data || []).map(async po => ({ ...po, quote_download_url: await getSignedDocumentUrl(po.quote_file_url) }))
    );

    return res.status(200).json({ success: true, purchaseOrders });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/purchase-orders:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/purchase-orders
// Crea una orden de compra en estado "pending_approval", con la cotización
// adjunta por quien solicita la compra/contratación de servicio.
router.post("/purchase-orders", async (req: Request, res: Response) => {
  try {
    const { tenant_id, vendor_id, requested_by, subtotal, tax_rate, total_cost, quote_file_data, quote_file_name, quote_title } = req.body;
    if (!tenant_id || !vendor_id || (subtotal === undefined && total_cost === undefined)) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, vendor_id, subtotal o total_cost)" });
    }

    let quote_file_url: string | null = null;
    if (quote_file_data) {
      try {
        quote_file_url = await uploadDocumentFile(quote_file_data, tenant_id, "purchase-orders", vendor_id, quote_file_name || "cotizacion");
      } catch (uploadError: any) {
        return res.status(400).json({ error: uploadError.message || "No se pudo subir la cotización." });
      }
    }

    // El impuesto (ej. ITBMS) se calcula sobre el subtotal, no se pide ya
    // sumado, para poder reportarlo por separado en declaraciones fiscales.
    let finalSubtotal: number, finalTaxRate: number, finalTaxAmount: number, finalTotal: number;
    if (subtotal !== undefined) {
      finalSubtotal = Number(subtotal);
      finalTaxRate = tax_rate !== undefined ? Number(tax_rate) : 0;
      finalTaxAmount = Number((finalSubtotal * (finalTaxRate / 100)).toFixed(2));
      finalTotal = Number((finalSubtotal + finalTaxAmount).toFixed(2));
    } else {
      finalTotal = Number(total_cost);
      finalSubtotal = finalTotal;
      finalTaxRate = 0;
      finalTaxAmount = 0;
    }

    const { data: purchaseOrder, error } = await supabaseAdmin
      .from("purchase_orders")
      .insert({
        tenant_id, vendor_id, requested_by: requested_by || null,
        subtotal: finalSubtotal, tax_rate: finalTaxRate, tax_amount: finalTaxAmount, total_cost: finalTotal,
        status: "pending_approval",
        quote_file_url: quote_file_url || null, quote_title: quote_title || null,
      })
      .select()
      .single();

    if (error || !purchaseOrder) {
      console.error("Error al crear orden de compra:", error);
      return res.status(500).json({ error: "Error al registrar la orden de compra." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "FINANCE",
      description: `Se solicitó una orden de compra por $${finalTotal} (subtotal $${finalSubtotal} + impuesto $${finalTaxAmount}) al proveedor (ID: ${vendor_id}).`,
      actor_name: "Procurement System",
    });

    return res.status(201).json({ success: true, message: "Orden de compra creada, pendiente de aprobación.", purchaseOrder });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/purchase-orders:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/purchase-orders/:id/status
// Aprueba o rechaza la cotización: pending_approval -> approved | cancelled.
// (Para pasar a "paid" hay que programarla primero con /schedule y luego
// confirmar el pago con /confirm-payment — ver abajo.)
router.post("/purchase-orders/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approved_by } = req.body; // 'approved' | 'cancelled'

    if (!["approved", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Estado inválido. Usa 'approved' o 'cancelled'." });
    }

    const { data: current } = await supabaseAdmin.from("purchase_orders").select("status").eq("id", id).single();
    if (!current) return res.status(404).json({ error: "Orden de compra no encontrada." });
    if (current.status !== "pending_approval") {
      return res.status(400).json({ error: "Solo se puede aprobar/rechazar una cotización que esté pendiente de aprobación." });
    }

    const { data: purchaseOrder, error } = await supabaseAdmin
      .from("purchase_orders")
      .update({ status, approved_by: approved_by || null })
      .eq("id", id)
      .select()
      .single();

    if (error || !purchaseOrder) return res.status(404).json({ error: "Orden de compra no encontrada." });

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: purchaseOrder.tenant_id,
      event_type: "FINANCE",
      description: `La cotización/orden de compra (ID: ${id}) fue "${status === "approved" ? "aprobada" : "rechazada"}".`,
      actor_name: "Procurement System",
    });

    return res.status(200).json({ success: true, message: `Orden de compra marcada como "${status}".`, purchaseOrder });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/purchase-orders/:id/status:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/purchase-orders/:id/schedule
// Contabilidad propone una fecha de pago para una orden ya aprobada.
// Queda en "scheduled", a la espera de la aprobación final del pago.
router.post("/purchase-orders/:id/schedule", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduled_payment_date, scheduled_by } = req.body;
    if (!scheduled_payment_date) return res.status(400).json({ error: "Falta la fecha programada de pago." });

    const { data: current } = await supabaseAdmin.from("purchase_orders").select("status, tenant_id").eq("id", id).single();
    if (!current) return res.status(404).json({ error: "Orden de compra no encontrada." });
    if (current.status !== "approved") {
      return res.status(400).json({ error: "Solo se puede programar el pago de una orden ya aprobada." });
    }

    const { data: purchaseOrder, error } = await supabaseAdmin
      .from("purchase_orders")
      .update({ status: "scheduled", scheduled_payment_date, scheduled_by: scheduled_by || null })
      .eq("id", id)
      .select()
      .single();

    if (error || !purchaseOrder) return res.status(500).json({ error: "No se pudo programar el pago." });

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: current.tenant_id,
      event_type: "FINANCE",
      description: `Contabilidad programó el pago de la orden de compra (ID: ${id}) para el ${scheduled_payment_date}.`,
      actor_name: "Accounting System",
    });

    return res.status(200).json({ success: true, message: "Pago programado, pendiente de aprobación final.", purchaseOrder });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/purchase-orders/:id/schedule:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/purchase-orders/:id/confirm-payment
// Aprueba y ejecuta un pago ya programado: scheduled -> paid.
router.post("/purchase-orders/:id/confirm-payment", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: current } = await supabaseAdmin.from("purchase_orders").select("status, tenant_id, total_cost").eq("id", id).single();
    if (!current) return res.status(404).json({ error: "Orden de compra no encontrada." });
    if (current.status !== "scheduled") {
      return res.status(400).json({ error: "Solo se puede confirmar el pago de una orden con fecha ya programada." });
    }

    const { data: purchaseOrder, error } = await supabaseAdmin
      .from("purchase_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !purchaseOrder) return res.status(500).json({ error: "No se pudo confirmar el pago." });

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: current.tenant_id,
      event_type: "FINANCE",
      description: `Se aprobó y confirmó el pago de $${current.total_cost} de la orden de compra (ID: ${id}).`,
      actor_name: "Accounting System",
    });

    return res.status(200).json({ success: true, message: "Pago confirmado.", purchaseOrder });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/purchase-orders/:id/confirm-payment:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// GASTOS RECURRENTES MENSUALES (ENERGÍA, AGUA, INTERNET, ETC.)
// ==========================================
// No necesitan una cotización nueva cada mes: se configuran una vez y
// cada periodo se "genera" el cargo correspondiente, que entra al mismo
// flujo de aprobación/programación/pago que cualquier orden de compra.

// GET /api/v1/corporate/recurring-expenses?tenant_id=...
router.get("/recurring-expenses", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("recurring_expenses")
      .select("*, vendors(name, service_type)")
      .eq("tenant_id", tenant_id)
      .order("concept");

    if (error) return res.status(500).json({ error: "Error al consultar los gastos recurrentes." });
    return res.status(200).json({ success: true, recurringExpenses: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/recurring-expenses:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/recurring-expenses
// Configura un gasto fijo mensual a un proveedor (ej. "Energía eléctrica" con ENSA)
router.post("/recurring-expenses", async (req: Request, res: Response) => {
  try {
    const { tenant_id, vendor_id, concept, estimated_amount, due_day, tax_rate } = req.body;
    if (!tenant_id || !vendor_id || !concept || estimated_amount === undefined) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, vendor_id, concept, estimated_amount)" });
    }

    const { data: recurringExpense, error } = await supabaseAdmin
      .from("recurring_expenses")
      .insert({ tenant_id, vendor_id, concept, estimated_amount, due_day: due_day || 5, tax_rate: tax_rate ?? 0 })
      .select()
      .single();

    if (error || !recurringExpense) {
      console.error("Error al crear el gasto recurrente:", error);
      return res.status(500).json({ error: "Error al configurar el gasto recurrente." });
    }

    return res.status(201).json({ success: true, message: "Gasto recurrente configurado.", recurringExpense });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/recurring-expenses:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/corporate/recurring-expenses/:id
// Edita el monto estimado o desactiva un gasto recurrente (ej. se canceló el servicio)
router.patch("/recurring-expenses/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estimated_amount, due_day, is_active, tax_rate } = req.body;

    const updates: Record<string, any> = {};
    if (estimated_amount !== undefined) updates.estimated_amount = estimated_amount;
    if (due_day !== undefined) updates.due_day = due_day;
    if (is_active !== undefined) updates.is_active = is_active;
    if (tax_rate !== undefined) updates.tax_rate = tax_rate;

    const { data: recurringExpense, error } = await supabaseAdmin
      .from("recurring_expenses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !recurringExpense) return res.status(404).json({ error: "Gasto recurrente no encontrado." });

    return res.status(200).json({ success: true, message: "Gasto recurrente actualizado.", recurringExpense });
  } catch (error: any) {
    console.error("Error en PATCH /api/v1/corporate/recurring-expenses/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/recurring-expenses/:id/generate
// Genera el cargo (orden de compra) de un gasto recurrente para un periodo
// dado (ej. "2026-09"). El monto se puede ajustar al monto real de la
// factura del proveedor (por eso "amount" es opcional, si no se manda usa
// el estimado). No se puede generar dos veces el mismo periodo.
router.post("/recurring-expenses/:id/generate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tenant_id, billing_period, amount, tax_rate, requested_by } = req.body;
    if (!tenant_id || !billing_period) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, billing_period)" });
    }

    const { data: recurringExpense } = await supabaseAdmin
      .from("recurring_expenses")
      .select("*")
      .eq("id", id)
      .single();

    if (!recurringExpense) return res.status(404).json({ error: "Gasto recurrente no encontrado." });

    const subtotal = amount !== undefined ? Number(amount) : Number(recurringExpense.estimated_amount);
    const rate = tax_rate !== undefined ? Number(tax_rate) : Number(recurringExpense.tax_rate || 0);
    const taxAmount = Number((subtotal * (rate / 100)).toFixed(2));
    const total = Number((subtotal + taxAmount).toFixed(2));

    const { data: purchaseOrder, error } = await supabaseAdmin
      .from("purchase_orders")
      .insert({
        tenant_id,
        vendor_id: recurringExpense.vendor_id,
        requested_by: requested_by || null,
        subtotal, tax_rate: rate, tax_amount: taxAmount, total_cost: total,
        status: "pending_approval",
        quote_title: `${recurringExpense.concept} - ${billing_period}`,
        recurring_expense_id: id,
        billing_period,
      })
      .select()
      .single();

    if (error || !purchaseOrder) {
      console.error("Error al generar el cargo recurrente:", error);
      if (error?.code === "23505") {
        return res.status(400).json({ error: `Ya se generó el cargo de "${recurringExpense.concept}" para ${billing_period}.` });
      }
      return res.status(500).json({ error: "Error al generar el cargo." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "FINANCE",
      description: `Se generó el cargo mensual de "${recurringExpense.concept}" (${billing_period}) por $${purchaseOrder.total_cost} (subtotal $${subtotal} + impuesto $${taxAmount}).`,
      actor_name: "Finance System",
    });

    return res.status(201).json({ success: true, message: "Cargo generado, pendiente de aprobación.", purchaseOrder });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/recurring-expenses/:id/generate:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// MÓDULO DE ACTIVOS FIJOS (COMPUTADORAS/PATRIMONIO)
// ==========================================

// GET /api/v1/corporate/assets?tenant_id=...
// Lista el inventario de activos fijos con su custodio actual (si tiene uno)
router.get("/assets", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("fixed_assets")
      .select("*, asset_assignments(assigned_to, returned_date, profiles(first_name, last_name))")
      .eq("tenant_id", tenant_id)
      .order("purchase_date", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar los activos." });

    // Solo nos interesa la asignación vigente (returned_date nulo) de cada activo
    const assets = (data || []).map((asset: any) => ({
      ...asset,
      current_assignment: asset.asset_assignments?.find((a: any) => !a.returned_date) || null,
      asset_assignments: undefined,
    }));

    return res.status(200).json({ success: true, assets });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/assets:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/assets
// Registra un nuevo activo fijo en el patrimonio (laptop, proyector, mobiliario)
router.post("/assets", async (req: Request, res: Response) => {
  try {
    const { tenant_id, asset_tag, name, category, purchase_value, purchase_date } = req.body;
    if (!tenant_id || !asset_tag || !name) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, asset_tag, name)" });
    }

    const { data: asset, error } = await supabaseAdmin
      .from("fixed_assets")
      .insert({ tenant_id, asset_tag, name, category, purchase_value, purchase_date, condition: "new" })
      .select()
      .single();

    if (error || !asset) {
      console.error("Error al registrar el activo:", error);
      if (error?.code === "23505") {
        return res.status(400).json({ error: "Ya existe un activo con esa placa/código." });
      }
      return res.status(500).json({ error: "Error al registrar el activo." });
    }

    return res.status(201).json({ success: true, message: "Activo registrado en el patrimonio.", asset });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/assets:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/assets/assign
// Asigna una laptop o proyector a un profesor
router.post("/assets/assign", async (req: Request, res: Response) => {
  try {
    const { tenant_id, asset_tag, assigned_to_profile_id, notes } = req.body;

    // 1. Buscar el ID del activo mediante su placa o código de barras
    const { data: asset } = await supabaseAdmin
      .from("fixed_assets")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("asset_tag", asset_tag)
      .single();

    if (!asset) return res.status(404).json({ error: "Activo no encontrado." });

    // 2. Crear la boleta de asignación
    const { data: assignment, error } = await supabaseAdmin
      .from("asset_assignments")
      .insert({
        asset_id: asset.id,
        assigned_to: assigned_to_profile_id,
        notes
      }).select().single();

    if (error) throw error;

    return res.status(201).json({ success: true, message: "Activo asignado exitosamente al staff.", assignment });
  } catch (error) {
    console.error("Error asignando activo:", error);
    return res.status(500).json({ error: "Fallo en asignación." });
  }
});

// ==========================================
// MÓDULO DE CONSUMIBLES (CENTRO DE COSTOS)
// ==========================================

// GET /api/v1/corporate/consumables?tenant_id=...
router.get("/consumables", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("consumables")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("name");

    if (error) return res.status(500).json({ error: "Error al consultar los consumibles." });
    return res.status(200).json({ success: true, consumables: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/consumables:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/consumables
// Da de alta un ítem en el catálogo de bodega (o su stock inicial)
router.post("/consumables", async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, unit_cost, stock_quantity, reorder_level } = req.body;
    if (!tenant_id || !name || unit_cost === undefined) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, name, unit_cost)" });
    }

    const { data: consumable, error } = await supabaseAdmin
      .from("consumables")
      .insert({ tenant_id, name, unit_cost, stock_quantity: stock_quantity || 0, reorder_level: reorder_level ?? 5 })
      .select()
      .single();

    if (error || !consumable) {
      console.error("Error al crear el consumible:", error);
      return res.status(500).json({ error: "Error al registrar el consumible." });
    }

    return res.status(201).json({ success: true, message: "Consumible agregado al catálogo de bodega.", consumable });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/consumables:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/consumables/dispatch
// Entrega resmas de papel/marcadores a un profesor y lo carga a su departamento
router.post("/consumables/dispatch", async (req: Request, res: Response) => {
  try {
    const { tenant_id, consumable_id, department_id, requested_by_profile_id, quantity } = req.body;

    // 1. Verificar stock actual y costo unitario
    const { data: item } = await supabaseAdmin
      .from("consumables")
      .select("stock_quantity, unit_cost, name")
      .eq("id", consumable_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!item) return res.status(404).json({ error: "Consumible no existe." });
    if (item.stock_quantity < quantity) {
      return res.status(400).json({ error: `Stock insuficiente. Solo quedan ${item.stock_quantity} unidades de ${item.name}.` });
    }

    const total_value = Number(item.unit_cost) * quantity;

    // 2. Registrar la salida del inventario (Gasto / Centro de Costo)
    await supabaseAdmin.from("consumable_transactions").insert({
      consumable_id,
      department_id,
      requested_by: requested_by_profile_id,
      quantity,
      transaction_type: "out",
      total_value
    });

    // 3. Descontar del Stock central
    // Nota: idealmente esto sería un RPC atómico en Postgres para evitar condiciones
    // de carrera bajo concurrencia; por ahora se hace vía SDK con el valor ya leído.
    await supabaseAdmin
      .from("consumables")
      .update({ stock_quantity: item.stock_quantity - quantity })
      .eq("id", consumable_id);

    return res.status(200).json({
      success: true,
      message: `Se despacharon ${quantity} unidades de ${item.name}. Costo cargado al departamento: $${total_value}`
    });

  } catch (error) {
    console.error("Error despachando consumible:", error);
    return res.status(500).json({ error: "Fallo al registrar el consumo." });
  }
});

// ==========================================
// MÓDULO DE RECURSOS HUMANOS Y NÓMINA (PAYROLL)
// ==========================================

// GET /api/v1/corporate/payroll-country-rules
// Catálogo de reglas de seguro social por país (referencia global, no es
// por tenant). Ver database_schemas/payroll_by_country_research.md.
router.get("/payroll-country-rules", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("payroll_country_rules")
      .select("*")
      .order("country_name");

    if (error) return res.status(500).json({ error: "Error al consultar las reglas de nómina por país." });
    return res.status(200).json({ success: true, countryRules: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/payroll-country-rules:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/corporate/employees?tenant_id=...
// Lista el staff (profesores/administrativos) dado de alta en nómina
router.get("/employees", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("hr_employees")
      .select("*, profiles(first_name, last_name, role, email)")
      .eq("tenant_id", tenant_id)
      .order("hire_date", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar el staff." });
    return res.status(200).json({ success: true, employees: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/employees:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/employees
// Da de alta a un profesor/administrativo en nómina, ya sea con salario
// mensual fijo o por hora (para docentes que no tienen dedicación
// exclusiva ni dan clase todos los días).
router.post("/employees", async (req: Request, res: Response) => {
  try {
    const {
      tenant_id, profile_id, hire_date, bank_account_info, tax_id, employment_type, custom_employee_rate,
      pay_type, base_salary, hourly_rate, hourly_prep_percent,
    } = req.body;

    if (!tenant_id || !profile_id || !hire_date) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, profile_id, hire_date)" });
    }
    const resolvedPayType = pay_type === "hourly" ? "hourly" : "monthly";
    if (resolvedPayType === "monthly" && (base_salary === undefined || base_salary === "")) {
      return res.status(400).json({ error: "Falta el salario base mensual." });
    }
    if (resolvedPayType === "hourly" && (hourly_rate === undefined || hourly_rate === "")) {
      return res.status(400).json({ error: "Falta la tarifa por hora." });
    }

    const { data: employee, error } = await supabaseAdmin
      .from("hr_employees")
      .insert({
        tenant_id, profile_id, hire_date, bank_account_info, tax_id,
        employment_type: employment_type || "local",
        custom_employee_rate: custom_employee_rate !== undefined && custom_employee_rate !== "" ? custom_employee_rate : null,
        pay_type: resolvedPayType,
        base_salary: resolvedPayType === "monthly" ? base_salary : null,
        hourly_rate: resolvedPayType === "hourly" ? hourly_rate : null,
        hourly_prep_percent: resolvedPayType === "hourly" && hourly_prep_percent !== undefined && hourly_prep_percent !== "" ? hourly_prep_percent : 0,
      })
      .select()
      .single();

    if (error || !employee) {
      console.error("Error al dar de alta al empleado:", error);
      return res.status(500).json({ error: "Error al registrar al empleado en nómina." });
    }

    const typeLabel = employment_type === "honorarios" ? "por honorarios profesionales (sin deducciones)" : employment_type === "expatriate" ? "expatriado" : "local";
    const payLabel = resolvedPayType === "hourly" ? `$${hourly_rate}/hora` : `$${base_salary}/mes`;
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "HR",
      description: `Se dio de alta en nómina al empleado (perfil ID: ${profile_id}), ${payLabel}, tipo: ${typeLabel}.`,
      actor_name: "HR System",
    });

    return res.status(201).json({ success: true, message: "Empleado registrado en nómina.", employee });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/employees:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// Calcula las horas reales que un docente tiene en su distributivo
// (class_schedules de sus classes) dentro de un rango de fechas, contando
// cada bloque una vez por cada día del periodo que coincida con su
// day_of_week (0=domingo...6=sábado, igual que Date#getDay()).
async function computeScheduledHours(tenantId: string, teacherProfileId: string, periodStart: string, periodEnd: string): Promise<number> {
  const { data: classes } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("teacher_id", teacherProfileId);

  const classIds = (classes || []).map(c => c.id);
  if (classIds.length === 0) return 0;

  const { data: blocks } = await supabaseAdmin
    .from("class_schedules")
    .select("day_of_week, start_time, end_time")
    .in("class_id", classIds);

  if (!blocks || blocks.length === 0) return 0;

  const blockHours = (start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em - (sh * 60 + sm)) / 60;
  };

  let totalHours = 0;
  const cursor = new Date(`${periodStart}T00:00:00`);
  const end = new Date(`${periodEnd}T00:00:00`);
  while (cursor <= end) {
    const dayOfWeek = cursor.getDay();
    for (const block of blocks) {
      if (block.day_of_week === dayOfWeek) {
        totalHours += blockHours(block.start_time, block.end_time);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Number(totalHours.toFixed(2));
}

// GET /api/v1/corporate/payroll/runs?tenant_id=...
// Lista las planillas (corridas de nómina) de un colegio
router.get("/payroll/runs", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("payroll_runs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("period_start", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar las planillas." });
    return res.status(200).json({ success: true, runs: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/payroll/runs:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/corporate/payroll/summary?tenant_id=...
// Acumulado mensual de nómina: agrupa TODAS las planillas ya calculadas
// (regulares + mes extra) por mes de inicio de periodo, sumando neto
// pagado a empleados, costo patronal adicional y el total general
// (lo que realmente le cuesta la nómina al colegio ese mes) — y además
// desglosa cada mes por tipo de contratación (local/expatriado/honorarios),
// porque no todos representan el mismo tipo de costo (honorarios no
// genera costo patronal, por ejemplo).
router.get("/payroll/summary", async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data: runs } = await supabaseAdmin
      .from("payroll_runs")
      .select("id, period_start, run_type, total_amount, employer_cost, status")
      .eq("tenant_id", tenant_id)
      .in("status", ["approved", "paid"])
      .order("period_start");

    if (!runs || runs.length === 0) return res.status(200).json({ success: true, months: [] });

    const runById = new Map(runs.map(r => [r.id, r]));

    const { data: paystubs, error: paystubsError } = await supabaseAdmin
      .from("paystubs")
      .select("payroll_run_id, gross_pay, deductions, net_pay, hr_employees(employment_type)")
      .in("payroll_run_id", runs.map(r => r.id));

    if (paystubsError) return res.status(500).json({ error: "Error al consultar los recibos de pago." });

    type TypeTotals = { grossPay: number; netPay: number; count: number };
    const emptyTypeTotals = (): TypeTotals => ({ grossPay: 0, netPay: 0, count: 0 });

    const byMonth: Record<string, {
      netPay: number; employerCost: number; runsCount: number; hasExtraMonth: boolean;
      byType: { local: TypeTotals; expatriate: TypeTotals; honorarios: TypeTotals };
    }> = {};

    const countedRunsByMonth: Record<string, Set<string>> = {};

    for (const stub of paystubs || []) {
      const run = runById.get((stub as any).payroll_run_id);
      if (!run) continue;
      const month = String(run.period_start).slice(0, 7); // "YYYY-MM"
      if (!byMonth[month]) {
        byMonth[month] = {
          netPay: 0, employerCost: 0, runsCount: 0, hasExtraMonth: false,
          byType: { local: emptyTypeTotals(), expatriate: emptyTypeTotals(), honorarios: emptyTypeTotals() },
        };
        countedRunsByMonth[month] = new Set();
      }
      const type: "local" | "expatriate" | "honorarios" = (stub as any).hr_employees?.employment_type || "local";
      byMonth[month].byType[type].grossPay += Number(stub.gross_pay);
      byMonth[month].byType[type].netPay += Number(stub.net_pay);
      byMonth[month].byType[type].count += 1;

      if (!countedRunsByMonth[month].has(run.id)) {
        countedRunsByMonth[month].add(run.id);
        byMonth[month].netPay += Number(run.total_amount || 0);
        byMonth[month].employerCost += Number(run.employer_cost || 0);
        byMonth[month].runsCount += 1;
        if (run.run_type === "extra_month") byMonth[month].hasExtraMonth = true;
      }
    }

    const months = Object.entries(byMonth)
      .map(([month, totals]) => {
        // El costo patronal se reparte proporcional al bruto de local+expatriado
        // (honorarios nunca genera costo patronal, por definición).
        const payrollGross = totals.byType.local.grossPay + totals.byType.expatriate.grossPay;
        const employerCostByType = {
          local: payrollGross > 0 ? Number((totals.employerCost * (totals.byType.local.grossPay / payrollGross)).toFixed(2)) : 0,
          expatriate: payrollGross > 0 ? Number((totals.employerCost * (totals.byType.expatriate.grossPay / payrollGross)).toFixed(2)) : 0,
          honorarios: 0,
        };
        return {
          month,
          netPay: totals.netPay,
          employerCost: totals.employerCost,
          runsCount: totals.runsCount,
          hasExtraMonth: totals.hasExtraMonth,
          grandTotal: Number((totals.netPay + totals.employerCost).toFixed(2)),
          byType: {
            local: { ...totals.byType.local, employerCost: employerCostByType.local },
            expatriate: { ...totals.byType.expatriate, employerCost: employerCostByType.expatriate },
            honorarios: { ...totals.byType.honorarios, employerCost: employerCostByType.honorarios },
          },
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    return res.status(200).json({ success: true, months });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/payroll/summary:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/corporate/payroll/runs/:id/paystubs
// Detalle de recibos de pago de una planilla ya calculada
router.get("/payroll/runs/:id/paystubs", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("paystubs")
      .select("*, hr_employees(profiles(first_name, last_name))")
      .eq("payroll_run_id", id)
      .order("net_pay", { ascending: false });

    if (error) return res.status(500).json({ error: "Error al consultar los recibos de pago." });
    return res.status(200).json({ success: true, paystubs: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/corporate/payroll/runs/:id/paystubs:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/payroll/runs
// Abre una nueva planilla en borrador para un periodo (ej. quincena, mes)
router.post("/payroll/runs", async (req: Request, res: Response) => {
  try {
    const { tenant_id, period_start, period_end, run_type } = req.body;
    if (!tenant_id || !period_start || !period_end) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, period_start, period_end)" });
    }

    const { data: run, error } = await supabaseAdmin
      .from("payroll_runs")
      .insert({ tenant_id, period_start, period_end, total_amount: 0, status: "draft", run_type: run_type || "regular" })
      .select()
      .single();

    if (error || !run) {
      console.error("Error al crear la planilla:", error);
      return res.status(500).json({ error: "Error al abrir la planilla." });
    }

    return res.status(201).json({ success: true, message: "Planilla abierta en borrador.", run });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/payroll/runs:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/payroll/runs/:id/calculate
// Calcula la planilla: genera un recibo de pago por cada empleado activo
// a partir de su salario base, aplicando el % de seguro social del país
// del colegio (tenants.country -> payroll_country_rules). Si la planilla
// es de "mes extra" (aguinaldo/décimo/prima) y el país tiene una cuota
// distinta para eso (ej. Panamá), usa esa en vez de la regular.
// deduction_rate sigue existiendo como override manual si se necesita.
router.post("/payroll/runs/:id/calculate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deduction_rate } = req.body; // ej. 0.12 = 12% de deducciones, opcional

    const { data: run } = await supabaseAdmin.from("payroll_runs").select("*").eq("id", id).single();
    if (!run) return res.status(404).json({ error: "Planilla no encontrada." });
    if (run.status !== "draft") return res.status(400).json({ error: "Esta planilla ya fue calculada/aprobada." });

    const { data: employees, error: employeesError } = await supabaseAdmin
      .from("hr_employees")
      .select("id, profile_id, base_salary, pay_type, hourly_rate, hourly_prep_percent, employment_type, custom_employee_rate")
      .eq("tenant_id", run.tenant_id)
      .eq("status", "active");

    if (employeesError) {
      return res.status(500).json({ error: "Error al consultar el staff activo." });
    }
    if (!employees || employees.length === 0) {
      return res.status(400).json({ error: "No hay empleados activos para calcular la planilla." });
    }

    let employeeRatePercent = 12; // valor por defecto si el colegio no tiene país configurado
    let employerRatePercent = 0;
    let ruleSource = "manual (sin país configurado)";

    if (typeof deduction_rate !== "number") {
      const { data: tenant } = await supabaseAdmin.from("tenants").select("country").eq("id", run.tenant_id).single();
      if (tenant?.country) {
        const { data: rule } = await supabaseAdmin
          .from("payroll_country_rules")
          .select("*")
          .eq("country_code", tenant.country)
          .single();

        if (rule) {
          const useExtraMonthRate = run.run_type === "extra_month" && rule.extra_month_has_own_rate;
          employeeRatePercent = Number(useExtraMonthRate ? rule.extra_month_employee_rate : rule.employee_rate);
          employerRatePercent = Number(useExtraMonthRate ? rule.extra_month_employer_rate : rule.employer_rate);
          ruleSource = `${rule.country_name} (${rule.social_security_label}${useExtraMonthRate ? ` — ${rule.extra_month_label}` : ""})`;
        }
      }
    }

    const defaultRate = typeof deduction_rate === "number" ? deduction_rate : employeeRatePercent / 100;

    // El % de deducción del país es el default para empleados "local".
    // Honorarios profesionales no es relación de planilla: no se le
    // descuenta nada. Expatriados (u otro caso especial) usan su propio
    // % si se configuró uno en el empleado, en vez del % del país.
    const rateForEmployee = (emp: any): number => {
      if (emp.employment_type === "honorarios") return 0;
      if (emp.custom_employee_rate !== null && emp.custom_employee_rate !== undefined) {
        return Number(emp.custom_employee_rate) / 100;
      }
      return defaultRate;
    };

    // Los empleados por hora (docentes sin dedicación exclusiva) cobran
    // sobre las horas reales de su distributivo (class_schedules) MÁS el %
    // de preparación/corrección configurado por empleado (el trabajo de un
    // docente no es solo la hora frente al grupo) — no un salario fijo.
    const resolvedGross = await Promise.all(employees.map(async emp => {
      if (emp.pay_type === "hourly") {
        const contactHours = await computeScheduledHours(run.tenant_id, emp.profile_id, run.period_start, run.period_end);
        const prepMultiplier = 1 + Number(emp.hourly_prep_percent || 0) / 100;
        const paidHours = Number((contactHours * prepMultiplier).toFixed(2));
        return { emp, grossPay: Number((paidHours * Number(emp.hourly_rate || 0)).toFixed(2)), hoursWorked: paidHours };
      }
      return { emp, grossPay: Number(emp.base_salary || 0), hoursWorked: null as number | null };
    }));

    const paystubs = resolvedGross.map(({ emp, grossPay, hoursWorked }) => {
      const rate = rateForEmployee(emp);
      const deductions = Number((grossPay * rate).toFixed(2));
      const netPay = Number((grossPay - deductions).toFixed(2));
      return {
        payroll_run_id: id,
        employee_id: emp.id,
        gross_pay: grossPay,
        deductions,
        net_pay: netPay,
        hours_worked: hoursWorked,
        status: "pending",
      };
    });

    const { error: paystubsError } = await supabaseAdmin.from("paystubs").insert(paystubs);
    if (paystubsError) {
      console.error("Error al generar recibos de pago:", paystubsError);
      return res.status(500).json({ error: "Error al generar los recibos de pago." });
    }

    const totalAmount = paystubs.reduce((sum, p) => sum + p.net_pay, 0);
    // El costo patronal solo aplica a empleados en relación de planilla
    // (local/expatriado); honorarios profesionales no genera cuota patronal.
    const totalGrossForEmployerCost = resolvedGross
      .filter(({ emp }) => emp.employment_type !== "honorarios")
      .reduce((sum, { grossPay }) => sum + grossPay, 0);
    const employerCost = Number((totalGrossForEmployerCost * (employerRatePercent / 100)).toFixed(2));

    const { data: updatedRun, error: updateError } = await supabaseAdmin
      .from("payroll_runs")
      .update({ total_amount: totalAmount, employer_cost: employerCost, status: "approved" })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error al actualizar la planilla:", updateError);
      return res.status(500).json({ error: "Los recibos se generaron pero no se pudo cerrar la planilla." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: run.tenant_id,
      event_type: "HR",
      description: `Planilla ${run.period_start} a ${run.period_end} calculada con reglas de ${ruleSource} (${(defaultRate * 100).toFixed(2)}% deducción base): ${paystubs.length} recibos por un total de $${totalAmount.toFixed(2)}. Costo patronal adicional estimado: $${employerCost.toFixed(2)}.`,
      actor_name: "HR System",
    });

    return res.status(200).json({
      success: true,
      message: `Planilla calculada (${ruleSource}, ${(defaultRate * 100).toFixed(2)}% deducción base): ${paystubs.length} recibos por un total de $${totalAmount.toFixed(2)}. Costo patronal adicional estimado: $${employerCost.toFixed(2)}.`,
      run: updatedRun,
      employerCost,
    });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/payroll/runs/:id/calculate:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/corporate/payroll/paystubs/:id/pay
// Marca un recibo de pago individual como pagado (ej. tras confirmar transferencia bancaria)
router.post("/payroll/paystubs/:id/pay", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: paystub, error } = await supabaseAdmin
      .from("paystubs")
      .update({ status: "paid", payment_date: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !paystub) return res.status(404).json({ error: "Recibo de pago no encontrado." });

    return res.status(200).json({ success: true, message: "Pago de nómina confirmado.", paystub });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/payroll/paystubs/:id/pay:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
