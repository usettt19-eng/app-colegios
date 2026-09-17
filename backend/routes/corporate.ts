import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// ==========================================
// MÓDULO DE ACTIVOS FIJOS (COMPUTADORAS/PATRIMONIO)
// ==========================================

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
    await supabaseAdmin.rpc("decrement_stock", { 
      c_id: consumable_id, 
      qty: quantity 
    });
    // Nota: decrement_stock sería una función SQL sencilla en Supabase para evitar condiciones de carrera.
    // Como alternativa por SDK (menos segura para concurrencia):
    // await supabaseAdmin.from("consumables").update({ stock_quantity: item.stock_quantity - quantity }).eq("id", consumable_id);

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
