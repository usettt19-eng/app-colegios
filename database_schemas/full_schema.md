# Migración Completa (Supabase) - SIS Core & SafeSmartPickup

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
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');

-- ==========================================
-- TABLAS CORE (SIS + Pickup Básicos)
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

-- 2. Exit Doors (Puertas de Salida)
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

-- 4. Students (Alumnos)
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
-- LOGÍSTICA AVANZADA (Reemplazos y Carpool)
-- ==========================================

-- 8. Replacement Requests (Reemplazos y Mensajes Libres)
CREATE TABLE public.replacement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    replacement_name TEXT NOT NULL, 
    replacement_phone TEXT NOT NULL,
    photo_url TEXT, 
    status request_status DEFAULT 'pending',
    is_recurring BOOLEAN NOT NULL DEFAULT true,
    days_of_week INT4[],
    student_ids UUID[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Carpool Authorizations (Días recurrentes)
CREATE TABLE public.carpool_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    authorizing_parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Carpool Overrides (Excepciones de 1 día)
CREATE TABLE public.carpool_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    authorizing_parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- SISTEMA BASE (Notificaciones y Auditoría)
-- ==========================================

-- 11. Notifications (Campana in-app vía Realtime)
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- FK directa a Auth!
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    pickup_event_id UUID REFERENCES public.pickup_events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Audit Logs (Bitácora inmutable)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_name TEXT, -- Sin FK para conservar historial
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ÍNDICES DE RENDIMIENTO
-- ==========================================
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_students_tenant ON public.students(tenant_id);
CREATE INDEX idx_pickup_events_tenant_status ON public.pickup_events(tenant_id, status);
CREATE INDEX idx_pickup_events_announced_at ON public.pickup_events(announced_at);
CREATE INDEX idx_replacement_reqs_tenant ON public.replacement_requests(tenant_id, status);
CREATE INDEX idx_carpool_auth_driver_day ON public.carpool_authorizations(driver_parent_id, day_of_week);
CREATE INDEX idx_carpool_overrides_driver_date ON public.carpool_overrides(driver_parent_id, override_date);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_tenant_type ON public.audit_logs(tenant_id, event_type);

-- ==========================================
-- EJEMPLO RLS BASICO
-- ==========================================
ALTER TABLE public.pickup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notificaciones: Los usuarios solo pueden ver las suyas
CREATE POLICY "Usuarios leen sus propias notificaciones"
ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- OJO: No hay política de INSERT en notificaciones porque toda inserción la debe hacer el Backend (Service Role).

-- Auditoría: Inserciones de audit_logs manejadas vía backend, solo el Staff lee (Básico)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff ve logs de su colegio"
ON public.audit_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.tenant_id = audit_logs.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);
```
