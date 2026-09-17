# Módulo de Cargos por Colegiatura (Fee Schedules) - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: FEE SCHEDULES (Tabla de Cargos)
-- ==========================================
-- Define cuánto cobrar por grado/concepto (colegiatura, transporte, etc.)
-- y permite generar facturas (invoices) automáticamente a partir de esa
-- definición, en vez de crear cada factura a mano.

-- ENUM
CREATE TYPE fee_recurrence AS ENUM ('mensual', 'anual', 'unico');

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Fee Schedules (Tabla de cargos: "grado X paga $250/mes por colegiatura")
CREATE TABLE public.fee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    grade TEXT NOT NULL, -- Debe coincidir con students.grade (ej. 'Kinder', '3ro Primaria')
    concept TEXT NOT NULL, -- Ej. 'Colegiatura', 'Transporte Escolar', 'Matrícula Anual'
    description TEXT,

    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    recurrence fee_recurrence NOT NULL DEFAULT 'mensual',
    due_day INT DEFAULT 5, -- Día del mes en que vence (para recurrencia mensual)
    accounting_code TEXT,

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- TRAZABILIDAD EN INVOICES
-- ==========================================
-- Vincula cada factura generada automáticamente con el cargo que la originó
-- y el periodo que cubre (ej. '2026-09'), para poder evitar duplicados.
ALTER TABLE public.invoices ADD COLUMN fee_schedule_id UUID REFERENCES public.fee_schedules(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN billing_period TEXT; -- 'YYYY-MM' o 'YYYY' según la recurrencia

-- Evita generar dos veces el mismo cargo para el mismo alumno en el mismo periodo
CREATE UNIQUE INDEX idx_invoices_fee_schedule_period
ON public.invoices(student_id, fee_schedule_id, billing_period)
WHERE fee_schedule_id IS NOT NULL;

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX idx_fee_schedules_tenant_grade ON public.fee_schedules(tenant_id, grade);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;

-- Solo el staff administrativo/financiero del colegio gestiona la tabla de cargos
CREATE POLICY "Staff administra la tabla de cargos de su colegio"
ON public.fee_schedules FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = fee_schedules.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);
```
