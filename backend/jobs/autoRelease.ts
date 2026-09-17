import cron from "node-cron";
import { supabaseAdmin } from "../supabase";

// Job: Auto-Release After Hours
// Este CRON se ejecuta cada 5 minutos
// Busca estudiantes que sigan "announced" o "in_queue" después de la hora de cierre,
// y los pasa a "released" automáticamente por seguridad/registro.
export const startAutoReleaseJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    console.log("[CRON] Ejecutando Auto-Release After Hours...");

    try {
      // 1. Encontrar colegios y eventos rezagados
      // Simplificado: Buscamos todos los eventos que tengan más de X horas sin ser despachados.
      // En producción, compararíamos con 'school_settings.auto_release_after_time'.
      
      const thresholdHours = 2; // Eventos estancados por más de 2 horas
      const thresholdDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

      const { data: pendingEvents, error } = await supabaseAdmin
        .from("pickup_events")
        .select("id, tenant_id, student_id")
        .in("status", ["announced", "in_queue"])
        .lt("announced_at", thresholdDate);

      if (error) {
        console.error("[CRON] Error consultando eventos rezagados:", error);
        return;
      }

      if (!pendingEvents || pendingEvents.length === 0) {
        console.log("[CRON] No hay eventos rezagados que liberar.");
        return;
      }

      console.log(`[CRON] Liberando automáticamente ${pendingEvents.length} alumnos rezagados...`);

      const timestamp = new Date().toISOString();
      const auditLogsToInsert = [];

      // 2. Actualizar a 'released'
      for (const event of pendingEvents) {
        await supabaseAdmin
          .from("pickup_events")
          .update({
            status: "released",
            verified_at: timestamp,
            notes: "Liberado automáticamente (Auto-Release After Hours)"
          })
          .eq("id", event.id);

        // Preparar log de auditoría
        auditLogsToInsert.push({
          tenant_id: event.tenant_id,
          event_type: "SYSTEM",
          description: `Auto-Release aplicado al alumno (ID: ${event.student_id}) por cierre de jornada.`,
          actor_name: "CRON Job Backend"
        });
      }

      // 3. Guardar logs de auditoría masivamente
      if (auditLogsToInsert.length > 0) {
        await supabaseAdmin.from("audit_logs").insert(auditLogsToInsert);
      }

      console.log("[CRON] Auto-Release completado exitosamente.");

    } catch (err) {
      console.error("[CRON] Error catastrófico en el job de Auto-Release:", err);
    }
  });
};
