import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

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
    return res.status(200).json({ success: true, purchaseOrders: data });
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
    const { tenant_id, vendor_id, requested_by, subtotal, tax_rate, total_cost, quote_file_url, quote_title } = req.body;
    if (!tenant_id || !vendor_id || (subtotal === undefined && total_cost === undefined)) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, vendor_id, subtotal o total_cost)" });
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
// Da de alta a un profesor/administrativo en nómina con su salario base
router.post("/employees", async (req: Request, res: Response) => {
  try {
    const { tenant_id, profile_id, hire_date, base_salary, bank_account_info, tax_id } = req.body;

    if (!tenant_id || !profile_id || !hire_date || base_salary === undefined) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, profile_id, hire_date, base_salary)" });
    }

    const { data: employee, error } = await supabaseAdmin
      .from("hr_employees")
      .insert({ tenant_id, profile_id, hire_date, base_salary, bank_account_info, tax_id })
      .select()
      .single();

    if (error || !employee) {
      console.error("Error al dar de alta al empleado:", error);
      return res.status(500).json({ error: "Error al registrar al empleado en nómina." });
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "HR",
      description: `Se dio de alta en nómina al empleado (perfil ID: ${profile_id}) con salario base $${base_salary}.`,
      actor_name: "HR System",
    });

    return res.status(201).json({ success: true, message: "Empleado registrado en nómina.", employee });
  } catch (error: any) {
    console.error("Error en POST /api/v1/corporate/employees:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

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
    const { tenant_id, period_start, period_end } = req.body;
    if (!tenant_id || !period_start || !period_end) {
      return res.status(400).json({ error: "Faltan parámetros requeridos (tenant_id, period_start, period_end)" });
    }

    const { data: run, error } = await supabaseAdmin
      .from("payroll_runs")
      .insert({ tenant_id, period_start, period_end, total_amount: 0, status: "draft" })
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
// a partir de su salario base, aplicando un porcentaje único de deducciones
// (seguro social / impuestos) sobre el bruto.
router.post("/payroll/runs/:id/calculate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deduction_rate } = req.body; // ej. 0.12 = 12% de deducciones

    const { data: run } = await supabaseAdmin.from("payroll_runs").select("*").eq("id", id).single();
    if (!run) return res.status(404).json({ error: "Planilla no encontrada." });
    if (run.status !== "draft") return res.status(400).json({ error: "Esta planilla ya fue calculada/aprobada." });

    const { data: employees, error: employeesError } = await supabaseAdmin
      .from("hr_employees")
      .select("id, base_salary")
      .eq("tenant_id", run.tenant_id)
      .eq("status", "active");

    if (employeesError) {
      return res.status(500).json({ error: "Error al consultar el staff activo." });
    }
    if (!employees || employees.length === 0) {
      return res.status(400).json({ error: "No hay empleados activos para calcular la planilla." });
    }

    const rate = typeof deduction_rate === "number" ? deduction_rate : 0.12;

    const paystubs = employees.map(emp => {
      const grossPay = Number(emp.base_salary);
      const deductions = Number((grossPay * rate).toFixed(2));
      const netPay = Number((grossPay - deductions).toFixed(2));
      return {
        payroll_run_id: id,
        employee_id: emp.id,
        gross_pay: grossPay,
        deductions,
        net_pay: netPay,
        status: "pending",
      };
    });

    const { error: paystubsError } = await supabaseAdmin.from("paystubs").insert(paystubs);
    if (paystubsError) {
      console.error("Error al generar recibos de pago:", paystubsError);
      return res.status(500).json({ error: "Error al generar los recibos de pago." });
    }

    const totalAmount = paystubs.reduce((sum, p) => sum + p.net_pay, 0);

    const { data: updatedRun, error: updateError } = await supabaseAdmin
      .from("payroll_runs")
      .update({ total_amount: totalAmount, status: "approved" })
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
      description: `Planilla ${run.period_start} a ${run.period_end} calculada: ${paystubs.length} recibos por un total de $${totalAmount.toFixed(2)}.`,
      actor_name: "HR System",
    });

    return res.status(200).json({
      success: true,
      message: `Planilla calculada: ${paystubs.length} recibos generados por un total de $${totalAmount.toFixed(2)}.`,
      run: updatedRun,
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
