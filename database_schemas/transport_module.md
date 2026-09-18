# Módulo de Transporte Escolar (Buses) - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: SCHOOL TRANSPORT (Buses)
-- ==========================================

-- 1. Buses (unidades de transporte del colegio)
CREATE TABLE public.buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name TEXT NOT NULL, -- Ej. "Bus 1", "Ruta Norte"
    plate TEXT, -- Placa del vehículo
    driver_name TEXT,
    driver_phone TEXT,
    capacity INT DEFAULT 30,
    route_description TEXT, -- Descripción libre del recorrido/paradas

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ASIGNACIÓN DE ALUMNOS A BUS
-- ==========================================
CREATE TYPE bus_direction AS ENUM ('ida', 'vuelta', 'ambos');

ALTER TABLE public.students ADD COLUMN bus_id UUID REFERENCES public.buses(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN bus_stop TEXT; -- Parada de recogida/entrega del alumno
ALTER TABLE public.students ADD COLUMN bus_direction bus_direction DEFAULT 'ambos';

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX idx_buses_tenant ON public.buses(tenant_id);
CREATE INDEX idx_students_bus ON public.students(bus_id);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros del colegio leen los buses"
ON public.buses FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = buses.tenant_id)
);

CREATE POLICY "Staff administra los buses de su colegio"
ON public.buses FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = buses.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);
```
