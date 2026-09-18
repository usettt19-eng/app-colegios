import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// ==========================================
// ROLES MANAGEMENT
// ==========================================

// GET /api/v1/rbac/roles?tenant_id=...
// List all roles for a tenant
router.get("/roles", requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("id, name, description, is_built_in, created_at")
      .eq("tenant_id", tenant_id)
      .order("name");

    if (error) return res.status(500).json({ error: "Error al consultar roles" });
    return res.status(200).json({ success: true, roles: data });
  } catch (error: any) {
    console.error("Error en GET /rbac/roles:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/rbac/roles
// Create a new role
router.post("/roles", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { tenant_id, name, description } = req.body;
    if (!tenant_id || !name) return res.status(400).json({ error: "Faltan parámetros requeridos" });

    const { data, error } = await supabaseAdmin
      .from("roles")
      .insert({
        tenant_id,
        name,
        description,
        created_by: (req as any).user?.id
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("duplicate")) {
        return res.status(400).json({ error: "Ya existe un rol con ese nombre" });
      }
      return res.status(500).json({ error: "Error al crear rol" });
    }

    return res.status(201).json({ success: true, role: data });
  } catch (error: any) {
    console.error("Error en POST /rbac/roles:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /api/v1/rbac/roles/:id
// Update a role
router.patch("/roles/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const { data, error } = await supabaseAdmin
      .from("roles")
      .update({ name, description })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: "Error al actualizar rol" });
    return res.status(200).json({ success: true, role: data });
  } catch (error: any) {
    console.error("Error en PATCH /rbac/roles/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/rbac/roles/:id
// Delete a role
router.delete("/roles/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if role is built-in
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("is_built_in")
      .eq("id", id)
      .single();

    if (role?.is_built_in) {
      return res.status(400).json({ error: "No se pueden eliminar roles del sistema" });
    }

    const { error } = await supabaseAdmin
      .from("roles")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ error: "Error al eliminar rol" });
    return res.status(200).json({ success: true, message: "Rol eliminado" });
  } catch (error: any) {
    console.error("Error en DELETE /rbac/roles/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// ROLE PERMISSIONS
// ==========================================

// GET /api/v1/rbac/roles/:id/permissions
// Get all permissions assigned to a role
router.get("/roles/:id/permissions", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("role_permissions")
      .select(`
        permission_id,
        permissions(
          id,
          permission_id,
          display_name,
          portal_sections(portal_id, section_id, display_name)
        )
      `)
      .eq("role_id", id);

    if (error) return res.status(500).json({ error: "Error al consultar permisos" });

    const permissions = data?.map((rp: any) => ({
      id: rp.permissions.id,
      permission_id: rp.permissions.permission_id,
      display_name: rp.permissions.display_name,
      section: rp.permissions.portal_sections
    })) || [];

    return res.status(200).json({ success: true, permissions });
  } catch (error: any) {
    console.error("Error en GET /rbac/roles/:id/permissions:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/rbac/roles/:id/permissions/:permissionId
// Add a permission to a role
router.post("/roles/:id/permissions/:permissionId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { id, permissionId } = req.params;

    const { error } = await supabaseAdmin
      .from("role_permissions")
      .insert({
        role_id: id,
        permission_id: permissionId
      });

    if (error) {
      if (error.message.includes("duplicate")) {
        return res.status(400).json({ error: "Este permiso ya está asignado" });
      }
      return res.status(500).json({ error: "Error al asignar permiso" });
    }

    return res.status(201).json({ success: true, message: "Permiso asignado" });
  } catch (error: any) {
    console.error("Error en POST /rbac/roles/:id/permissions/:permissionId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/rbac/roles/:id/permissions/:permissionId
// Remove a permission from a role
router.delete("/roles/:id/permissions/:permissionId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { id, permissionId } = req.params;

    const { error } = await supabaseAdmin
      .from("role_permissions")
      .delete()
      .eq("role_id", id)
      .eq("permission_id", permissionId);

    if (error) return res.status(500).json({ error: "Error al remover permiso" });
    return res.status(200).json({ success: true, message: "Permiso removido" });
  } catch (error: any) {
    console.error("Error en DELETE /rbac/roles/:id/permissions/:permissionId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// PROFILE ROLE ASSIGNMENTS
// ==========================================

// GET /api/v1/rbac/profile/:profileId/roles?tenant_id=...
// Get all roles assigned to a profile
router.get("/profile/:profileId/roles", requireAuth, async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const { data, error } = await supabaseAdmin
      .from("profile_role_assignments")
      .select(`
        id,
        role_id,
        department_id,
        roles(id, name, description),
        departments(name)
      `)
      .eq("profile_id", profileId)
      .eq("tenant_id", tenant_id);

    if (error) return res.status(500).json({ error: "Error al consultar roles" });
    return res.status(200).json({ success: true, assignments: data });
  } catch (error: any) {
    console.error("Error en GET /rbac/profile/:profileId/roles:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/rbac/assign-role
// Assign a role to a profile
router.post("/assign-role", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { tenant_id, profile_id, role_id, department_id } = req.body;
    if (!tenant_id || !profile_id || !role_id) {
      return res.status(400).json({ error: "Faltan parámetros requeridos" });
    }

    const { data, error } = await supabaseAdmin
      .from("profile_role_assignments")
      .insert({
        tenant_id,
        profile_id,
        role_id,
        department_id: department_id || null,
        assigned_by: (req as any).user?.id
      })
      .select(`
        id,
        roles(name),
        departments(name)
      `)
      .single();

    if (error) {
      if (error.message.includes("duplicate")) {
        return res.status(400).json({ error: "Este perfil ya tiene asignado este rol" });
      }
      return res.status(500).json({ error: "Error al asignar rol" });
    }

    // Log audit trail
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id,
      event_type: "RBAC",
      description: `Rol asignado: ${(data as any).roles?.name} a perfil ${profile_id}`,
      actor_name: "Admin Interface"
    });

    return res.status(201).json({ success: true, assignment: data });
  } catch (error: any) {
    console.error("Error en POST /rbac/assign-role:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /api/v1/rbac/assign-role/:assignmentId
// Remove a role from a profile
router.delete("/assign-role/:assignmentId", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;

    const { error } = await supabaseAdmin
      .from("profile_role_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) return res.status(500).json({ error: "Error al remover rol" });
    return res.status(200).json({ success: true, message: "Rol removido" });
  } catch (error: any) {
    console.error("Error en DELETE /rbac/assign-role/:assignmentId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// ==========================================
// PORTAL SECTIONS & PERMISSIONS
// ==========================================

// GET /api/v1/rbac/portal-sections
// Get all available portal sections
router.get("/portal-sections", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("portal_sections")
      .select("*")
      .order("portal_id", { ascending: true })
      .order("section_id", { ascending: true });

    if (error) return res.status(500).json({ error: "Error al consultar secciones" });
    return res.status(200).json({ success: true, sections: data });
  } catch (error: any) {
    console.error("Error en GET /rbac/portal-sections:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/rbac/permissions/:sectionId
// Get all permissions for a portal section
router.get("/permissions/:sectionId", async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("permissions")
      .select("*")
      .eq("section_id", sectionId)
      .order("permission_id");

    if (error) return res.status(500).json({ error: "Error al consultar permisos" });
    return res.status(200).json({ success: true, permissions: data });
  } catch (error: any) {
    console.error("Error en GET /rbac/permissions/:sectionId:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
