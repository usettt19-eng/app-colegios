# Módulo de Tareas y Asignaciones (Tipo i-Mereb) - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: ASSIGNMENTS & HOMEWORK (i-Mereb Style)
-- ==========================================

CREATE TYPE assignment_status AS ENUM ('pending', 'submitted', 'late', 'graded', 'excused');

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Assignments (Las tareas creadas por el Profesor)
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Teacher
    
    title TEXT NOT NULL,
    description TEXT,
    attachment_url TEXT, -- Link a un PDF, documento, etc.
    
    due_date TIMESTAMPTZ NOT NULL,
    max_score DECIMAL(5,2) DEFAULT 100.00,
    type TEXT NOT NULL DEFAULT 'tarea' CHECK (type IN ('tarea', 'examen', 'actividad', 'proyecto')), -- Para el calendario "Notas y Agendas"
    
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Student Assignments (Las entregas de los Alumnos)
CREATE TABLE public.student_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    
    status assignment_status DEFAULT 'pending',
    submission_url TEXT, -- Link al trabajo entregado por el alumno
    submitted_at TIMESTAMPTZ,
    
    score DECIMAL(5,2),
    teacher_feedback TEXT,
    graded_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(assignment_id, student_id) -- Un alumno solo tiene un registro de entrega por tarea
);

-- ==========================================
-- ÍNDICES PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_assignments_class ON public.assignments(class_id);
CREATE INDEX idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX idx_student_assignments_student ON public.student_assignments(student_id, status);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assignments ENABLE ROW LEVEL SECURITY;

-- Profesores ven y administran tareas de sus clases
CREATE POLICY "Docentes ven tareas de sus clases"
ON public.assignments FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.classes WHERE classes.id = assignments.class_id AND classes.teacher_id = auth.uid())
);

-- Padres/Alumnos ven las tareas asignadas a su clase
CREATE POLICY "Padres ven tareas asignadas a sus hijos"
ON public.assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.class_enrollments
        JOIN public.enrollments ON enrollments.id = class_enrollments.enrollment_id
        JOIN public.parent_students ON parent_students.student_id = enrollments.student_id
        WHERE class_enrollments.class_id = assignments.class_id
        AND parent_students.parent_id = auth.uid()
    )
);

-- Padres/Alumnos ven y entregan sus propias tareas
CREATE POLICY "Padres ven estado de tareas de sus hijos"
ON public.student_assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_students 
        WHERE parent_students.student_id = student_assignments.student_id
        AND parent_students.parent_id = auth.uid()
    )
);
```
