# Módulo de Configuración de Grados y Secciones - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: GRADE LEVELS & SECTIONS (Configuración del colegio)
-- ==========================================
-- Antes, "grade" y "section" eran texto libre en students/fee_schedules,
-- sin ningún catálogo central: cada formulario dejaba escribir lo que
-- fuera, con riesgo de typos que rompieran silenciosamente el cruce con
-- la tabla de cargos. Este módulo los convierte en un ajuste real del
-- colegio: una lista de grados, y por cada grado, sus secciones.

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Grade Levels (ej. "Kinder", "1ro Primaria", "5to Primaria"...)
CREATE TABLE public.grade_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name TEXT NOT NULL, -- Debe coincidir con students.grade y fee_schedules.grade
    sort_order INT DEFAULT 0, -- Para mostrar los grados en el orden correcto (Kinder antes que 1ro...)

    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- 2. Grade Sections (ej. "A", "B", "Los Tucanes" dentro de un grado)
CREATE TABLE public.grade_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name TEXT NOT NULL, -- Debe coincidir con students.section

    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(grade_level_id, name)
);

-- ==========================================
-- ASIGNACIÓN DE ALUMNOS A SECCIÓN
-- ==========================================
-- Los alumnos se asignan directamente a una sección (no a un grado suelto);
-- el grado se deriva de grade_sections -> grade_levels. Se mantienen
-- students.grade/section como texto (denormalizado) para no romper a los
-- consumidores existentes (dashboard del padre, tabla de cargos, etc.),
-- pero ahora se llenan a partir de la sección elegida, no a mano.
ALTER TABLE public.students ADD COLUMN grade_section_id UUID REFERENCES public.grade_sections(id) ON DELETE SET NULL;

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX idx_grade_levels_tenant ON public.grade_levels(tenant_id, sort_order);
CREATE INDEX idx_grade_sections_level ON public.grade_sections(grade_level_id);
CREATE INDEX idx_students_grade_section ON public.students(grade_section_id);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_sections ENABLE ROW LEVEL SECURITY;

-- Cualquiera con sesión en el colegio puede leer el catálogo (lo usan
-- Admisiones, Costos, etc.); solo el staff administrativo lo edita.
CREATE POLICY "Miembros del colegio leen sus grados"
ON public.grade_levels FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = grade_levels.tenant_id)
);

CREATE POLICY "Staff administra los grados de su colegio"
ON public.grade_levels FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = grade_levels.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Miembros del colegio leen sus secciones"
ON public.grade_sections FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = grade_sections.tenant_id)
);

CREATE POLICY "Staff administra las secciones de su colegio"
ON public.grade_sections FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = grade_sections.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);
```
