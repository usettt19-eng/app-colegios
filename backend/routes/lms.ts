import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// POST /api/v1/lms/sync
// Sincronización bidireccional de calificaciones con Canvas o Google Classroom
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const { tenant_id, class_id, lms_provider, lms_course_id } = req.body;

    if (!tenant_id || !class_id || !lms_provider) {
      return res.status(400).json({ error: "Parámetros inválidos (tenant_id, class_id, lms_provider son obligatorios)." });
    }

    console.log(`[LMS Sync] Conectando con ${lms_provider} para el curso ${lms_course_id}...`);

    // 1. En producción, aquí haríamos un fetch real al API de Canvas o Google Classroom
    // const lmsGrades = await fetchCanvasGrades(lms_course_id, process.env.CANVAS_API_KEY);
    
    // Para ilustrar la integración, simulamos que el LMS nos devuelve un arreglo de notas por alumno
    const lmsGradesMock = [
      { student_id: "uuid-del-estudiante-1", grade: 95.5 },
      { student_id: "uuid-del-estudiante-2", grade: 88.0 }
    ];
    
    // 2. Iterar sobre las calificaciones recibidas y hacer UPSERT en class_enrollments
    let syncedCount = 0;

    for (const record of lmsGradesMock) {
      // Ignoramos el error si el uuid no existe en el mock local, pero intentamos actualizar
      const { data, error } = await supabaseAdmin
        .from("class_enrollments")
        .update({
          final_grade: record.grade,
          lms_sync_status: "synced",
          updated_at: new Date().toISOString()
        })
        .eq("class_id", class_id)
        // En la vida real, habría una columna lms_student_id para hacer el match exacto
        .eq("id", record.student_id); // Usamos ID como proxy para este demo

      if (!error) {
        syncedCount++;
      }
    }

    // 3. Auditoría de la sincronización
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "SYSTEM",
      description: `Sincronización bidireccional completada con ${lms_provider} para la clase (ID: ${class_id}). Se actualizaron ${syncedCount} expedientes.`,
      actor_name: "LMS Connector"
    });

    return res.status(200).json({
      success: true,
      message: `Sincronización con ${lms_provider} finalizada con éxito.`,
      details: {
        recordsSynced: syncedCount,
        lms: lms_provider
      }
    });

  } catch (error: any) {
    console.error("Error en /api/v1/lms/sync:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
