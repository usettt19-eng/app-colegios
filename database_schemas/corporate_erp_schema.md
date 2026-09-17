# Corporate ERP & Recursos Humanos (Multi-Tenant)

Este esquema expande el sistema hacia un ERP corporativo completo para la administración interna del colegio.

```sql
-- ==========================================
-- 1. RECURSOS HUMANOS Y NÓMINA (PAYROLL)
-- ==========================================

-- Detalles contractuales y bancarios del Staff (Profesores, Administrativos)
CREATE TABLE public.hr_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hire_date DATE NOT NULL,
    base_salary NUMERIC(10,2) NOT NULL,
    bank_account_info JSONB, -- Número de cuenta, banco, tipo
    tax_id TEXT, -- RUC, SSN, etc.
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Procesamiento de Nómina Quincenal/Mensual
CREATE TABLE public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Recibos de pago individuales (Paystubs)
CREATE TABLE public.paystubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.hr_employees(id),
    gross_pay NUMERIC(10,2) NOT NULL,
    deductions NUMERIC(10,2) DEFAULT 0,
    net_pay NUMERIC(10,2) NOT NULL,
    payment_date TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid'))
);

-- ==========================================
-- 2. CUENTAS POR PAGAR (PROVEEDORES Y COMPRAS)
-- ==========================================

CREATE TABLE public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_email TEXT,
    tax_id TEXT,
    service_type TEXT -- Ej: 'Mantenimiento', 'Suministros', 'Servicios Web'
);

-- Órdenes de Compra y Gastos Operativos
CREATE TABLE public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id),
    requested_by UUID REFERENCES public.profiles(id),
    total_cost NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. PATRIMONIO Y ASIGNACIÓN DE ACTIVOS (IT)
-- ==========================================

-- Inventario de Bienes Fijos (Laptops, Proyectores, Pupitres)
CREATE TABLE public.fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    asset_tag TEXT UNIQUE NOT NULL, -- Código de barras o placa del colegio
    name TEXT NOT NULL,
    category TEXT, -- 'IT', 'Mobiliario', 'Laboratorio'
    purchase_value NUMERIC(10,2),
    purchase_date DATE,
    condition TEXT DEFAULT 'good' CHECK (condition IN ('new', 'good', 'needs_repair', 'retired'))
);

-- Custodia de Equipos (A quién se le asignó la computadora)
CREATE TABLE public.asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.fixed_assets(id),
    assigned_to UUID NOT NULL REFERENCES public.profiles(id), -- A qué profesor/staff
    assigned_date TIMESTAMPTZ DEFAULT now(),
    returned_date TIMESTAMPTZ, -- Nulo si lo tiene actualmente
    notes TEXT
);

-- ==========================================
-- 4. INVENTARIO DE CONSUMIBLES (CENTRO DE COSTOS)
-- ==========================================

-- Catálogo de Consumibles (Marcadores, Resmas, Tinta)
CREATE TABLE public.consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_cost NUMERIC(8,2) NOT NULL, -- Costo promedio por unidad
    stock_quantity INT DEFAULT 0,
    reorder_level INT DEFAULT 5 -- Alarma cuando hay poco inventario
);

-- Control de Salida de Consumibles (Para costeo por departamento/profesor)
CREATE TABLE public.consumable_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumable_id UUID NOT NULL REFERENCES public.consumables(id),
    department_id UUID REFERENCES public.departments(id), -- A qué centro de costos va
    requested_by UUID REFERENCES public.profiles(id), -- Quién lo pidió
    quantity INT NOT NULL, -- Cantidad que sacó de bodega
    transaction_type TEXT CHECK (transaction_type IN ('in', 'out')), -- in = Compra, out = Consumo
    total_value NUMERIC(10,2) NOT NULL, -- Para reportes financieros
    created_at TIMESTAMPTZ DEFAULT now()
);
```
