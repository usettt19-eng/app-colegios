# Módulo de Control de Faltas (Asistencia) - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: ATTENDANCE & WARNINGS
-- ==========================================

-- ENUMS
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE alert_risk_level AS ENUM ('low', 'medium', 'high', 'critical');

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Attendance Records (Registro diario / por materia)
-- Sirve tanto para asistencia a nivel colegio (diaria) como a nivel clase.
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE, -- Opcional, si es asistencia por materia
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Profesor o admin que pasó lista
    
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status attendance_status NOT NULL,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, class_id, date) -- Un registro por alumno, por materia, por día
);

-- 2. Behavioral & Academic Alerts (Alertas de Deserción y Disciplina)
-- Sistema preventivo que reacciona a las faltas o problemas.
CREATE TABLE public.student_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL, -- Ej: 'CRITICAL_ABSENCE_STREAK', 'LOW_GRADES', 'DISCIPLINE'
    risk_level alert_risk_level DEFAULT 'medium',
    description TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    
    -- Seguimiento y tutorías
    assigned_tutor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ÍNDICES PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_attendance_student_date ON public.attendance_records(student_id, date);
CREATE INDEX idx_alerts_student_status ON public.student_alerts(student_id, is_resolved);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_alerts ENABLE ROW LEVEL SECURITY;

-- Padres solo ven la asistencia y alertas de sus hijos
CREATE POLICY "Padres ven asistencia de sus hijos"
ON public.attendance_records FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_students 
        WHERE parent_students.student_id = attendance_records.student_id
        AND parent_students.parent_id = auth.uid()
    )
);

CREATE POLICY "Docentes pueden registrar asistencia en sus clases"
ON public.attendance_records FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.classes 
        WHERE classes.id = attendance_records.class_id
        AND classes.teacher_id = auth.uid()
    ) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
```
