# Módulo ERP Financiero - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: FINANCIAL ERP & BILLING
-- ==========================================

-- ENUMS
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
CREATE TYPE payment_method AS ENUM ('stripe', 'paypal', 'bank_transfer', 'cash', 'quickbooks_sync');

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Invoices (Facturas de colegiatura, extracurriculares, etc.)
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Tutor responsable financiero
    
    invoice_number TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    
    status invoice_status DEFAULT 'open',
    due_date DATE NOT NULL,
    issued_date DATE DEFAULT CURRENT_DATE,
    
    -- Integración con ERP Externos
    quickbooks_invoice_id TEXT,
    stripe_payment_intent_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, invoice_number)
);

-- 2. Invoice Line Items (Detalle de la factura)
CREATE TABLE public.invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    
    description TEXT NOT NULL, -- Ej: 'Colegiatura Septiembre 2026', 'Transporte Escolar'
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0, -- Para aplicar becas
    total_amount DECIMAL(10,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount) STORED,
    
    accounting_code TEXT, -- Para sincronización con el Plan de Cuentas contable
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Payments (Recibos de Pago)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT now(),
    method payment_method NOT NULL,
    
    transaction_reference TEXT, -- ID del banco o de Stripe
    receipt_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ÍNDICES PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_invoices_student_status ON public.invoices(student_id, status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Padres solo ven las facturas asignadas a ellos o a sus hijos
CREATE POLICY "Padres ven sus facturas"
ON public.invoices FOR SELECT USING (
    parent_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.parent_students 
        WHERE parent_students.student_id = invoices.student_id
        AND parent_students.parent_id = auth.uid()
    )
);

CREATE POLICY "Padres ven el detalle de sus facturas"
ON public.invoice_line_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.invoices 
        WHERE invoices.id = invoice_line_items.invoice_id 
        AND (
            invoices.parent_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.parent_students WHERE parent_students.student_id = invoices.student_id AND parent_students.parent_id = auth.uid())
        )
    )
);

CREATE POLICY "Padres ven sus pagos"
ON public.payments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.invoices 
        WHERE invoices.id = payments.invoice_id 
        AND (
            invoices.parent_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.parent_students WHERE parent_students.student_id = invoices.student_id AND parent_students.parent_id = auth.uid())
        )
    )
);
```
