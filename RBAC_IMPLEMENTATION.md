# RBAC (Role-Based Access Control) Implementation

## Overview

A comprehensive, granular role-based access control system that allows fine-grained permissions management by portal section and action. This enables precise control over who can view, create, edit, delete, approve, calculate, schedule, or export data in each section of each portal.

## Architecture

### Database Schema

Five new tables work together to implement RBAC:

#### 1. `roles`
Defines custom roles per tenant. Examples: "Admin Académico", "Admin Finanzas", "Coordinador Académico".
```sql
- id: UUID (primary key)
- tenant_id: UUID (FK to tenants)
- name: VARCHAR(100) - unique per tenant
- description: TEXT
- is_built_in: BOOLEAN - system roles are marked as such
- created_at: TIMESTAMP
- created_by: UUID (FK to profiles)
```

#### 2. `portal_sections`
Registry of all protectable sections across all portals.
- Admin: organization, academic_years, grades_sections, costs, bulk_import, student_directory
- Finance: quotes_purchases, payment_scheduling, cashflow, tax_reports, budget_control, bank_reconciliation, student_discounts
- Corporate/ERP: payroll, hr_leave, substitute_assignments, facilities, teacher_evaluations, assets
- Admissions: prospects, enrollments
- Teacher: attendance, grading, assignments, my_file, messaging
- Parent: grades, payments, messaging, medical_file

#### 3. `permissions`
Granular action permissions that can be assigned to roles.
- **view** - View content
- **create** - Create new records
- **edit** - Edit existing records
- **delete** - Delete records
- **approve** - Approve requests or changes
- **calculate** - Calculate values (e.g., payroll runs)
- **schedule** - Schedule actions (e.g., payment scheduling)
- **export** - Export data to CSV/Excel

Note: Not all sections support all permissions (e.g., bulk_import only supports 'create').

#### 4. `role_permissions`
Many-to-many relationship linking roles to permissions.
```sql
- id: UUID (primary key)
- role_id: UUID (FK to roles)
- permission_id: UUID (FK to permissions)
- created_at: TIMESTAMP
```

#### 5. `profile_role_assignments`
Links profiles (users) to roles, with optional department scoping.
```sql
- id: UUID (primary key)
- tenant_id: UUID (FK to tenants)
- profile_id: UUID (FK to profiles)
- role_id: UUID (FK to roles)
- department_id: UUID (nullable FK to departments) - for department-scoped roles
- assigned_at: TIMESTAMP
- assigned_by: UUID (nullable FK to profiles)
```

Unique constraints ensure:
- One role per profile (when no department specified)
- One role per profile+department combination (when department is specified)

### Backend Implementation

#### Middleware: `backend/middleware/rbac.ts`

**`loadRBACPermissions(req, res, next)`**
- Loads all permissions for the authenticated user
- Groups permissions as `"portal:section:permission"` strings in `req.rbacPermissions` Set
- Falls back gracefully if user has no RBAC assignments
- Runs on every request after auth middleware

**`requirePermission(options)`**
- Express middleware that enforces a specific permission
- Returns 403 Forbidden if user lacks permission
- Bypasses checks for `super_admin` users
- Falls back to legacy role (`admin`) for backward compatibility

**Helper functions:**
- `checkPermission(req, portal, section, permission)` - Boolean check without blocking
- `getUserRoles(profileId, tenantId)` - Get all role names for a user

#### API Routes: `backend/routes/rbac.ts`

All endpoints require `requireAuth` middleware. Admin operations also require `requireRole("admin")`.

**Roles Management:**
- `GET /api/v1/rbac/roles?tenant_id=...` - List all roles for a tenant
- `POST /api/v1/rbac/roles` - Create new custom role
- `PATCH /api/v1/rbac/roles/:id` - Update role (name, description)
- `DELETE /api/v1/rbac/roles/:id` - Delete role (cannot delete built-in roles)

**Role Permissions:**
- `GET /api/v1/rbac/roles/:id/permissions` - List permissions assigned to a role
- `POST /api/v1/rbac/roles/:id/permissions/:permissionId` - Add permission to role
- `DELETE /api/v1/rbac/roles/:id/permissions/:permissionId` - Remove permission from role

**Profile Role Assignments:**
- `GET /api/v1/rbac/profile/:profileId/roles?tenant_id=...` - Get roles assigned to a profile
- `POST /api/v1/rbac/assign-role` - Assign a role to a profile (with optional department scope)
- `DELETE /api/v1/rbac/assign-role/:assignmentId` - Remove a role from a profile

**Portal Sections & Permissions (Read-Only):**
- `GET /api/v1/rbac/portal-sections` - List all available portal sections
- `GET /api/v1/rbac/permissions/:sectionId` - List permissions for a section

All RBAC API operations are audited via `audit_logs` table.

### Frontend Implementation

#### Component: `src/portals/RBACManager.tsx`

Comprehensive React component for managing RBAC, accessed via Admin portal → "Permisos (RBAC)" tab.

**Two Main Modes:**

1. **Roles Management**
   - List all roles for the tenant
   - Create new custom roles
   - Select a role and view/assign/remove its permissions
   - Permissions grouped by portal (Admin, Finance, Corporate, Admissions, Teacher, Parent) for clarity
   - Toggle permissions on/off with visual feedback

2. **Staff Assignment**
   - List all staff members
   - Select a staff member and view their currently assigned roles
   - Assign available roles to staff
   - Remove role assignments
   - Each assignment can optionally be scoped to a department

## Usage Workflow

### 1. Create a Custom Role

1. Admin → "Permisos (RBAC)" tab → "Gestión de Roles"
2. Click "Nuevo Rol"
3. Enter role name (e.g., "Admin de Finanzas Restrictivo")
4. Enter description (optional)
5. Click "Crear Rol"

### 2. Assign Permissions to the Role

1. Select the role from the left panel
2. Right panel shows all available permissions grouped by portal section
3. For each section, click permission badges to toggle them on/off
   - Blue badge = assigned
   - Gray badge = not assigned
4. Permissions are saved immediately to backend

### 3. Assign Role to a Staff Member

1. Switch to "Asignación a Staff" tab
2. Select a staff member from the left list
3. Right panel shows "Roles Asignados" and "Roles Disponibles"
4. Click on an available role to assign it
5. Click the X button on an assigned role to remove it
6. Assignments are saved immediately

### Optional: Department-Scoped Roles

When assigning a role to staff, you can optionally scope it to a specific department:

```bash
POST /api/v1/rbac/assign-role
{
  "tenant_id": "...",
  "profile_id": "...",
  "role_id": "...",
  "department_id": "..." // Optional - scopes role to this dept only
}
```

This allows the same person to have different roles in different departments.

## Permission Resolution

When a user makes a request to a protected endpoint:

1. **Authentication** - middleware `requireAuth` confirms user is logged in
2. **RBAC Loading** - middleware `loadRBACPermissions` loads user's permissions into `req.rbacPermissions`
3. **Authorization** - endpoint's `requirePermission()` middleware checks if user has the required permission
4. **Permission Check Logic:**
   - If user is `super_admin` → Allow (bypass RBAC)
   - If user has the permission in `req.rbacPermissions` → Allow
   - If user's `profiles.role == 'admin'` → Allow (backward compatibility with legacy system)
   - Otherwise → Deny with 403 Forbidden

## Backward Compatibility

The RBAC system is **fully backward compatible** with the existing role system:

- If a user has no entries in `profile_role_assignments`, their access is determined by their `profiles.role` field
- Any user with `profiles.role = 'admin'` can perform any action (same as before)
- `super_admin` always bypasses RBAC checks
- Portals without Fase 2 auth can still use legacy role checking while RBAC is implemented
- New portals can gradually opt-in to RBAC by calling `requirePermission()` on their endpoints

## Security Notes

- **RLS Enabled** on all RBAC tables with policies allowing access within tenant scope
- **Audit Trail** - all RBAC changes logged to `audit_logs` table
- **No Data Breach** - permissions are checked server-side; frontend RBAC UI can only view what it's already authorized to see
- **Immutable Built-In Roles** - system roles marked `is_built_in=true` cannot be deleted
- **Atomic Assignments** - unique constraints prevent duplicate role assignments to same profile

## Deployment Instructions

```bash
# 1. Pull the latest changes
cd ~/app-colegios
git pull origin claude/loving-bardeen-snlh1m

# 2. Rebuild Docker image (includes new backend routes and frontend components)
docker compose build --no-cache

# 3. Deploy
docker compose up -d

# 4. The RBAC schema was already applied to production Supabase during development
#    If starting fresh or resetting DB, run the migration:
#    - The schema is in database_schemas/rbac_init.sql
#    - Use Supabase web console or apply via MCP tool
```

## Future Enhancements

1. **Conditional Permissions** - Add support for conditions like "edit only own department's data"
2. **Time-Based Roles** - Roles that automatically activate/deactivate on schedule
3. **Approval Chains** - Multi-level approval workflows built on RBAC
4. **API Scoping** - Limit API key access to specific roles/permissions
5. **Audit Dashboard** - Visual timeline of all RBAC changes and permission usage
6. **Role Templates** - Pre-built role templates for common job positions
7. **Permission Inheritance** - Roles can inherit permissions from other roles
8. **Delegation** - Allow users to temporarily grant permissions to others

## Troubleshooting

**"Permiso denegado" error when accessing a section:**
- Check that the user's role has been assigned the required permission
- Verify the permission exists for that portal section
- Check Admin → Permisos (RBAC) → Asignación a Staff

**Missing portal sections:**
- Verify `portal_sections` table was seeded correctly
- Some sections may not be implemented yet in all portals
- Check `database_schemas/rbac_schema.md` for planned sections

**Roles not appearing in dropdown:**
- Ensure roles are created for the correct `tenant_id`
- Check that the logged-in user's tenant matches the role's tenant

**Performance issues with many roles:**
- RBAC permissions are cached per-request in `req.rbacPermissions`
- Consider implementing role caching if many users assigned many roles
- Add database indexes on `profile_role_assignments(profile_id)` if needed
