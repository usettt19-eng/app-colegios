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

export default router;
