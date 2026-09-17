# Módulo de Contratos de Ingreso (Admisiones) - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: ADMISSION CONTRACTS
-- ==========================================

-- 1. Contract Templates (Plantillas de Contrato por Colegio)
-- Permite que cada colegio (tenant) tenga su propia redacción legal.
CREATE TABLE public.contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL, -- Ej: "Contrato K-12 2026-2027", "Contrato Preescolar"
    html_body TEXT NOT NULL, -- Plantilla con variables como {{student_name}}, {{parent_name}}, {{fee}}
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Solo el Staff administrativo puede gestionar y leer las plantillas
CREATE POLICY "Staff administra plantillas de contratos"
ON public.contract_templates FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.tenant_id = contract_templates.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);
```
