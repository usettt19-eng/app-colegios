-- RBAC (Role-Based Access Control) System
-- Applies roles and permissions by portal section

-- 1. roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  is_built_in boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, name)
);

-- 2. portal_sections table
CREATE TABLE IF NOT EXISTS portal_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id varchar(50) NOT NULL,
  section_id varchar(100) NOT NULL,
  display_name varchar(200) NOT NULL,
  description text,
  created_at timestamp DEFAULT now(),
  UNIQUE(portal_id, section_id)
);

-- 3. permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES portal_sections(id) ON DELETE CASCADE,
  permission_id varchar(100) NOT NULL,
  display_name varchar(200) NOT NULL,
  description text,
  created_at timestamp DEFAULT now(),
  UNIQUE(section_id, permission_id)
);

-- 4. role_permissions table (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- 5. profile_role_assignments table
CREATE TABLE IF NOT EXISTS profile_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_at timestamp DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Unique constraint: one role per profile, or one role per profile+department
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_role_unique_no_dept
  ON profile_role_assignments(profile_id, role_id)
  WHERE department_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_role_unique_with_dept
  ON profile_role_assignments(profile_id, role_id, department_id)
  WHERE department_id IS NOT NULL;

-- Create indexes
CREATE INDEX idx_roles_tenant ON roles(tenant_id);
CREATE INDEX idx_profile_role_assignments_tenant ON profile_role_assignments(tenant_id);
CREATE INDEX idx_profile_role_assignments_profile ON profile_role_assignments(profile_id);
CREATE INDEX idx_profile_role_assignments_role ON profile_role_assignments(role_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_permissions_section ON permissions(section_id);

-- Seed default portal sections
INSERT INTO portal_sections (portal_id, section_id, display_name, description)
VALUES
  -- Admin Portal
  ('admin', 'organization', 'Organization & Staff', 'Manage organization settings, staff directory, departments'),
  ('admin', 'academic_years', 'Academic Years', 'Manage academic years, grading periods, evaluation plans'),
  ('admin', 'grades_sections', 'Grades & Sections', 'Manage grade levels and sections'),
  ('admin', 'costs', 'Costs & Fee Schedules', 'Manage fee schedules, discounts, scholarships'),
  ('admin', 'bulk_import', 'Bulk Import', 'Import students, parents, staff from CSV'),
  ('admin', 'student_directory', 'Student Directory', 'View and manage student records'),

  -- Finance Portal
  ('finance', 'quotes_purchases', 'Quotes & Purchases', 'Manage purchase orders and vendor quotes'),
  ('finance', 'payment_scheduling', 'Payment Scheduling', 'Schedule and confirm payments'),
  ('finance', 'cashflow', 'Cashflow Reports', 'View financial reports and dashboards'),
  ('finance', 'tax_reports', 'Tax Reports', 'View tax summaries and declarations'),
  ('finance', 'budget_control', 'Budget Control', 'Manage department budgets'),
  ('finance', 'bank_reconciliation', 'Bank Reconciliation', 'Reconcile bank statements'),
  ('finance', 'student_discounts', 'Scholarships & Discounts', 'Manage student discounts and scholarships'),

  -- Corporate/ERP Portal
  ('corporate', 'payroll', 'Payroll & Nómina', 'Manage payroll runs and salary calculations'),
  ('corporate', 'hr_leave', 'HR Leave Management', 'Manage leave requests and absences'),
  ('corporate', 'substitute_assignments', 'Substitute Assignments', 'Assign substitute teachers'),
  ('corporate', 'facilities', 'Facility Booking', 'Manage and book facilities'),
  ('corporate', 'teacher_evaluations', 'Teacher Evaluations', 'Conduct teacher performance evaluations'),
  ('corporate', 'assets', 'Assets & Patrimony', 'Manage IT and physical assets'),

  -- Admissions Portal
  ('admissions', 'prospects', 'Prospect Pipeline', 'Manage prospect CRM and pipeline'),
  ('admissions', 'enrollments', 'Student Enrollment', 'Enroll new students'),

  -- Teacher Portal
  ('teacher', 'attendance', 'Attendance', 'Take and manage class attendance'),
  ('teacher', 'grading', 'Grading & Rubrics', 'Grade assignments and manage rubrics'),
  ('teacher', 'assignments', 'Assignments', 'Create and manage assignments'),
  ('teacher', 'my_file', 'My File', 'Upload and manage personal documents'),
  ('teacher', 'messaging', 'Messaging', 'Send messages to parents'),

  -- Parent Portal
  ('parent', 'grades', 'Grades & Bulletin', 'View student grades and bulletin'),
  ('parent', 'payments', 'Payment Center', 'View and pay invoices'),
  ('parent', 'messaging', 'Messaging', 'Send messages to school'),
  ('parent', 'medical_file', 'Medical File', 'Manage medical information')
ON CONFLICT DO NOTHING;

-- Seed default permissions
WITH section_map AS (
  SELECT id, portal_id, section_id FROM portal_sections
)
INSERT INTO permissions (section_id, permission_id, display_name, description)
SELECT
  sm.id,
  perm.permission_id,
  perm.display_name,
  perm.description
FROM section_map sm
CROSS JOIN (
  VALUES
    ('view', 'View', 'View content'),
    ('create', 'Create', 'Create new records'),
    ('edit', 'Edit', 'Edit existing records'),
    ('delete', 'Delete', 'Delete records'),
    ('approve', 'Approve', 'Approve requests'),
    ('calculate', 'Calculate', 'Calculate values (e.g., payroll)'),
    ('schedule', 'Schedule', 'Schedule actions (e.g., payments)'),
    ('export', 'Export', 'Export data to CSV/Excel')
) AS perm(permission_id, display_name, description)
WHERE
  -- Not all sections get all permissions
  CASE
    WHEN sm.section_id IN ('bulk_import') THEN perm.permission_id IN ('create')
    WHEN sm.section_id IN ('cashflow', 'tax_reports', 'grades') THEN perm.permission_id IN ('view', 'export')
    ELSE perm.permission_id IN ('view', 'create', 'edit', 'delete', 'approve', 'calculate', 'schedule', 'export')
  END
ON CONFLICT DO NOTHING;

-- Enable RLS on RBAC tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- roles: users can see roles for their tenant
CREATE POLICY "roles_tenant_access" ON roles
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- profile_role_assignments: users can see assignments for their tenant
CREATE POLICY "assignments_tenant_access" ON profile_role_assignments
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- portal_sections: public read (needed for UI)
CREATE POLICY "sections_public_read" ON portal_sections
  FOR SELECT USING (true);

-- permissions: public read
CREATE POLICY "permissions_public_read" ON permissions
  FOR SELECT USING (true);

-- role_permissions: public read
CREATE POLICY "role_permissions_public_read" ON role_permissions
  FOR SELECT USING (true);
