# Módulo de Horarios y Boletines - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: SCHEDULES & REPORT CARDS
-- ==========================================

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Class Schedules (Distributivo de Horarios por Clase)
CREATE TABLE public.class_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    
    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    room_number TEXT, -- Ej: "Aula 204", "Lab Química"
    
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Evitar que una clase se cruce a sí misma
    UNIQUE(class_id, day_of_week, start_time) 
);

-- 2. Report Cards (Boletines de Calificaciones Finales)
CREATE TABLE public.report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
    
    gpa DECIMAL(4,2), -- Promedio general del periodo
    general_comments TEXT, -- Comentarios del tutor
    
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(enrollment_id, term_id)
);

-- 3. Report Card Details (Detalle de notas por materia en el boletín)
CREATE TABLE public.report_card_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_card_id UUID NOT NULL REFERENCES public.report_cards(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    
    final_score DECIMAL(5,2) NOT NULL,
    teacher_comments TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_card_id, class_id)
);

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX idx_class_schedules_tenant ON public.class_schedules(tenant_id);
CREATE INDEX idx_report_cards_student ON public.report_cards(student_id, is_published);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_card_details ENABLE ROW LEVEL SECURITY;

-- Cualquiera (Padres/Profes) puede ver horarios
CREATE POLICY "Lectura pública de horarios" 
ON public.class_schedules FOR SELECT USING (true);

-- Padres ven boletines (solo si están publicados)
CREATE POLICY "Padres ven boletines publicados"
ON public.report_cards FOR SELECT USING (
    is_published = true AND
    EXISTS (
        SELECT 1 FROM public.parent_students 
        WHERE parent_students.student_id = report_cards.student_id
        AND parent_students.parent_id = auth.uid()
    )
);

CREATE POLICY "Padres ven detalle de boletines"
ON public.report_card_details FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.report_cards 
        WHERE report_cards.id = report_card_details.report_card_id
        AND report_cards.is_published = true
        AND EXISTS (
            SELECT 1 FROM public.parent_students 
            WHERE parent_students.student_id = report_cards.student_id
            AND parent_students.parent_id = auth.uid()
        )
    )
);
```
