# Migración Inicial (Supabase)

```sql
-- ==========================================
-- SUPABASE MIGRATION: SIS + SafeSmartPickup
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- ENUMS
-- ==========================================
CREATE TYPE user_role AS ENUM ('admin', 'parent', 'teacher', 'guard', 'super_admin');
CREATE TYPE pickup_status AS ENUM ('announced', 'in_queue', 'dispatched', 'released', 'completed', 'cancelled');

-- ==========================================
-- TABLAS CORE
-- ==========================================

-- 1. Tenants (Colegios)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    status TEXT DEFAULT 'active',
    subscription_plan TEXT DEFAULT 'basic',
    default_language TEXT NOT NULL DEFAULT 'es',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Exit Doors (Puertas de Salida - referenciado en pickup_events)
CREATE TABLE public.exit_doors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Profiles (Padres, Staff, Buses)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    pin_code TEXT,
    photo_url TEXT,
    additional_tutor_name TEXT,
    additional_tutor_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, pin_code)
);

-- 4. Students (Alumnos - Core SIS + Pickup)
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    grade TEXT,
    section TEXT,
    photo_url TEXT,
    self_dismissal_allowed BOOLEAN NOT NULL DEFAULT false,
    self_dismissal_qr_token TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. SIS Extension: Student Academic Records
CREATE TABLE public.student_academic_records (
    student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
    enrollment_status TEXT DEFAULT 'enrolled',
    gpa DECIMAL(3,2),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Parent_Students (Vínculo M:N / Rosters de Bus)
CREATE TABLE public.parent_students (
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    relationship TEXT,
    PRIMARY KEY (parent_id, student_id)
);

-- 7. Pickup Events (El corazón logístico)
CREATE TABLE public.pickup_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    door_id UUID REFERENCES public.exit_doors(id) ON DELETE SET NULL,
    
    status pickup_status NOT NULL DEFAULT 'announced',
    location_verified BOOLEAN NOT NULL DEFAULT true,
    
    announced_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    notes TEXT
);

-- ==========================================
-- ÍNDICES RECOMENDADOS PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_students_tenant ON public.students(tenant_id);
CREATE INDEX idx_pickup_events_tenant_status ON public.pickup_events(tenant_id, status);
CREATE INDEX idx_pickup_events_announced_at ON public.pickup_events(announced_at);

-- ==========================================
-- EJEMPLO BASE DE RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.pickup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Padres ven sus propios eventos de recogida" 
ON public.pickup_events FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "Staff ve todos los eventos de su colegio"
ON public.pickup_events FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.tenant_id = pickup_events.tenant_id
        AND profiles.role IN ('admin', 'teacher', 'guard')
    )
);
```
