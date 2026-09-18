# RBAC (Role-Based Access Control) by Portal Section

## Overview
Fine-grained authorization system allowing custom roles per tenant with permissions assigned by portal section and action. Supports both role-based and direct profile assignments.

## Tables

### 1. `roles`
Custom role definitions per tenant (beyond the generic `profiles.role` of admin/teacher/guard/parent/super_admin).

```sql
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL, -- e.g., "Admin Académico", "Coordinador", "Colector"
  description text,
  is_built_in boolean DEFAULT false, -- true for system roles like "Super Admin", "Teacher", "Parent"
  created_at timestamp DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(tenant_id, name)
);
```

### 2. `portal_sections`
Registry of all portal sections that can be protected by RBAC.

```sql
CREATE TABLE portal_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id varchar(50) NOT NULL, -- 'admin', 'teacher', 'parent', 'finance', 'corporate', 'admissions'
  section_id varchar(100) NOT NULL, -- 'attendance', 'grades', 'organization', 'payroll', etc.
  display_name varchar(200) NOT NULL,
  description text,
  created_at timestamp DEFAULT now(),
  UNIQUE(portal_id, section_id)
);
```

### 3. `permissions`
Granular action permissions that can be assigned to roles.

```sql
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES portal_sections(id) ON DELETE CASCADE,
  permission_id varchar(100) NOT NULL, -- 'view', 'create', 'edit', 'delete', 'approve'
  display_name varchar(200) NOT NULL, -- "Ver Asistencia", "Calificar Tareas", "Aprobar Pagos"
  description text,
  created_at timestamp DEFAULT now(),
  UNIQUE(section_id, permission_id)
);
```

### 4. `role_permissions`
Many-to-many: which permissions belong to which roles.

```sql
CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(role_id, permission_id)
);
```

### 5. `profile_role_assignments`
Assign profiles to roles (can have multiple roles). Optional department_id for department-level RBAC.

```sql
CREATE TABLE profile_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL, -- optional, for dept-scoped roles
  assigned_at timestamp DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  UNIQUE(profile_id, role_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'))
);
```

## Default Roles (Seeded per Tenant)

1. **Admin Académico** — full control over: attendance, grades, assignments, evaluation plans, grading periods, courses
2. **Admin Finanzas** — full control over: invoices, payments, purchase orders, budgets, bank reconciliation
3. **Admin RRHH/Nómina** — full control over: payroll, employee records, leave requests, evaluation cycles
4. **Coordinador Académico** — can: view/edit grades, attendance, assignments; manage leave/substitutes; limited to own department
5. **Colector de Pagos** — can: view invoices, record payments (no refunds/edits)
6. **Docente Contenido** — can: grade own classes, manage attendance; cannot see admin features
7. **Docente Mensajería** — limited to messaging only
8. **Bedel/Asistente** — can: take attendance, record leave requests
9. **Recepcionista Admisiones** — can: manage prospects, schedule visits/exams
10. **Contador** — can: view financial reports, reconcile bank statements; cannot approve orders

## Authorization Approach

1. **Fallback to `profiles.role`** — if a profile has no role assignment in `profile_role_assignments`, check their generic `profiles.role` (admin/teacher/guard/parent)
2. **Multiple roles** — a profile can have multiple roles (e.g., "Admin Académico" AND "Admin Finanzas"); permissions union
3. **Department-scoped roles** — optional `department_id` allows roles like "Admin Finanzas" to apply only to a single department's data
4. **Superadmin bypass** — `profiles.role='super_admin'` always has full access (no RBAC check)

## Backward Compatibility

- Existing portals without role assignments continue to work: `profiles.role` is sufficient
- New RBAC is opt-in: once enabled for a section, only users with explicit permissions can access it
- Gradual migration: portals can adopt RBAC section-by-section without disrupting the whole app

## Portal Sections to Protect (Phase 1)

| Portal | Section | View | Create | Edit | Delete | Approve | Other |
|--------|---------|------|--------|------|--------|---------|-------|
| **Admin** | Organization | ✓ | ✓ | ✓ | ✓ | | |
| | Academic Years | ✓ | ✓ | ✓ | ✓ | | |
| | Grades/Sections | ✓ | ✓ | ✓ | ✓ | | |
| | Costs (Fee Schedules) | ✓ | ✓ | ✓ | ✓ | | |
| | Staff Directory | ✓ | ✓ | ✓ | ✓ | | |
| | Bulk Import | | ✓ | | | | |
| **Finance** | Quotes/Purchases | ✓ | ✓ | ✓ | | ✓ | |
| | Payment Scheduling | ✓ | | ✓ | | ✓ | |
| | Cashflow Reports | ✓ | | | | | |
| | Tax Reports | ✓ | | | | | |
| | Budget Control | ✓ | ✓ | ✓ | | | |
| | Bank Reconciliation | ✓ | | | | | |
| **Corporate/ERP** | Payroll | ✓ | ✓ | ✓ | | ✓ | Calculate |
| | HR Leave | ✓ | ✓ | | | ✓ | |
| | Substitute Assignments | ✓ | ✓ | ✓ | ✓ | | |
| | Facilities/Booking | ✓ | ✓ | ✓ | ✓ | | |
| | Teacher Evaluations | ✓ | ✓ | ✓ | ✓ | | |
| | Assets/Patrimony | ✓ | ✓ | ✓ | ✓ | | |
| **Admissions** | Prospects | ✓ | ✓ | ✓ | | | |
| | Enrollments | ✓ | ✓ | ✓ | | | |
| **Teacher** | Attendance | ✓ | ✓ | | | | |
| | Grades/Rubrics | ✓ | ✓ | ✓ | ✓ | | |
| | Assignments | ✓ | ✓ | ✓ | ✓ | | |
| | My File (expediente) | ✓ | ✓ | | | | |
| | Messaging | ✓ | ✓ | | | | |
| **Parent** | Grades/Bulletin | ✓ | | | | | |
| | Payments | ✓ | | | | | |
| | Messaging | ✓ | ✓ | | | | |
| | Medical File | ✓ | ✓ | | | | |

## Migration SQL

See `rbac_init.sql` for seeding default roles and permissions.
