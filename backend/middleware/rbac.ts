import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../supabase";

// Extend Express Request to include RBAC data
declare global {
  namespace Express {
    interface Request {
      rbacPermissions?: Set<string>;
      userRole?: string;
      hasPermission?: (permission: string) => boolean;
    }
  }
}

export interface RequirePermissionOptions {
  portal: string;
  section: string;
  permission: string;
}

// Load user's permissions from RBAC tables
export const loadRBACPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profileId = (req as any).user?.id;
    const tenantId = (req as any).tenant_id || (req as any).user?.app_metadata?.tenant_id;

    if (!profileId || !tenantId) {
      req.rbacPermissions = new Set();
      return next();
    }

    // Get all roles assigned to this profile
    const { data: assignments } = await supabaseAdmin
      .from("profile_role_assignments")
      .select(`
        role_id,
        roles!inner(id, name),
        profile_role_assignments(id)
      `)
      .eq("profile_id", profileId)
      .eq("tenant_id", tenantId);

    if (!assignments || assignments.length === 0) {
      req.rbacPermissions = new Set();
      return next();
    }

    // Collect all unique permissions from all assigned roles
    const roleIds = assignments
      .map(a => a.role_id)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);

    if (roleIds.length === 0) {
      req.rbacPermissions = new Set();
      return next();
    }

    // Get all permissions for these roles
    const { data: rolePerms } = await supabaseAdmin
      .from("role_permissions")
      .select(`
        permission_id,
        permissions!inner(
          section_id,
          permissions(portal_sections(portal_id, section_id), permission_id)
        )
      `)
      .in("role_id", roleIds);

    // Build a set of "portal:section:permission" strings
    const permissions = new Set<string>();
    if (rolePerms) {
      for (const rp of rolePerms) {
        if (rp.permissions) {
          const perm = rp.permissions as any;
          if (perm.portal_sections) {
            const key = `${perm.portal_sections.portal_id}:${perm.portal_sections.section_id}:${perm.permission_id}`;
            permissions.add(key);
          }
        }
      }
    }

    req.rbacPermissions = permissions;

    // Helper function to check permission
    req.hasPermission = (permission: string) => {
      return req.rbacPermissions?.has(permission) || false;
    };

    next();
  } catch (error) {
    console.error("Error loading RBAC permissions:", error);
    req.rbacPermissions = new Set();
    next();
  }
};

// Middleware to require specific permission
export const requirePermission = (options: RequirePermissionOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Super admin bypass
    if ((req as any).user?.app_metadata?.role === "super_admin") {
      return next();
    }

    // Check if user has the required permission
    const permissionKey = `${options.portal}:${options.section}:${options.permission}`;

    if (req.rbacPermissions?.has(permissionKey)) {
      return next();
    }

    // If no RBAC permission, fallback to legacy role check
    const userRole = (req as any).user?.app_metadata?.role;
    if (userRole === "admin" || userRole === "super_admin") {
      // Legacy admin can do anything (backward compatibility)
      return next();
    }

    return res.status(403).json({
      error: "Permiso denegado",
      details: `No tienes permiso para ${options.permission} en ${options.section}`
    });
  };
};

// Check permission without blocking (returns boolean)
export const checkPermission = (req: Request, portal: string, section: string, permission: string): boolean => {
  // Super admin bypass
  if ((req as any).user?.app_metadata?.role === "super_admin") {
    return true;
  }

  // Check RBAC
  const permissionKey = `${portal}:${section}:${permission}`;
  if (req.rbacPermissions?.has(permissionKey)) {
    return true;
  }

  // Fallback to legacy role
  const userRole = (req as any).user?.app_metadata?.role;
  return userRole === "admin" || userRole === "super_admin";
};

// Get user's roles for a tenant
export const getUserRoles = async (profileId: string, tenantId: string): Promise<string[]> => {
  const { data } = await supabaseAdmin
    .from("profile_role_assignments")
    .select("roles(name)")
    .eq("profile_id", profileId)
    .eq("tenant_id", tenantId);

  if (!data) return [];
  return data
    .map((a: any) => a.roles?.name)
    .filter(Boolean);
};
