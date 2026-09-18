import cron from "node-cron";
import { supabaseAdmin } from "../supabase";

// Job: Recordatorio de Gastos Recurrentes
// Corre una vez al día. Por cada gasto recurrente activo (energía, agua,
// internet...), si su próximo día de pago cae en exactamente 15 días y
// todavía NO se ha generado el cargo (purchase_order) de ese periodo,
// notifica a los admins del colegio para que no se les pase.
function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((utcTo - utcFrom) / msPerDay);
}

function periodLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const startRecurringExpenseReminderJob = () => {
  cron.schedule("0 8 * * *", async () => {
    console.log("[CRON] Revisando recordatorios de gastos recurrentes...");

    try {
      const { data: recurringExpenses, error } = await supabaseAdmin
        .from("recurring_expenses")
        .select("id, tenant_id, concept, due_day, vendors(name)")
        .eq("is_active", true);

      if (error) {
        console.error("[CRON] Error consultando gastos recurrentes:", error);
        return;
      }
      if (!recurringExpenses || recurringExpenses.length === 0) return;

      const today = new Date();

      for (const re of recurringExpenses) {
        // El próximo vencimiento puede caer este mes o el que viene
        const candidates = [
          new Date(today.getFullYear(), today.getMonth(), re.due_day),
          new Date(today.getFullYear(), today.getMonth() + 1, re.due_day),
        ];

        for (const dueDate of candidates) {
          if (daysBetween(today, dueDate) !== 15) continue;

          const billingPeriod = periodLabel(dueDate);

          const { data: existingPO } = await supabaseAdmin
            .from("purchase_orders")
            .select("id")
            .eq("recurring_expense_id", re.id)
            .eq("billing_period", billingPeriod)
            .maybeSingle();

          if (existingPO) continue; // ya se generó el cargo, no hace falta recordar

          const { data: admins } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("tenant_id", re.tenant_id)
            .in("role", ["admin", "super_admin"]);

          if (!admins || admins.length === 0) continue;

          const vendorName = (re as any).vendors?.name || "el proveedor";
          await supabaseAdmin.from("notifications").insert(
            admins.map(a => ({
              tenant_id: re.tenant_id,
              user_id: a.id,
              title: "Gasto recurrente próximo a vencer",
              message: `"${re.concept}" (${vendorName}) vence el ${dueDate.toLocaleDateString("es")}. Genera el cargo de ${billingPeriod} desde Finanzas → Cotizaciones y Compras.`,
              type: "warning",
            }))
          );

          console.log(`[CRON] Recordatorio enviado: "${re.concept}" (tenant ${re.tenant_id}), vence ${billingPeriod}.`);
        }
      }
    } catch (err) {
      console.error("[CRON] Error catastrófico en recordatorios de gastos recurrentes:", err);
    }
  });
};
