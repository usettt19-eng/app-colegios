# Módulo Académico y CRM - Esquema SQL

Copia y pega este script en el **SQL Editor** de Supabase. Este script crea la estructura para manejar los ciclos escolares, las materias, y las matrículas de los estudiantes.

```sql
-- ==========================================
-- SIS MODULE: ACADEMIC & CRM (Enrollments)
-- ==========================================

-- ENUMS
CREATE TYPE enrollment_status AS ENUM ('pending_signature', 'active', 'suspended', 'withdrawn', 'graduated');

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Academic Terms (Ciclos Escolares / Periodos)
-- Ej: "Año Lectivo 2026-2027", "Semestre 1 2026"
CREATE TABLE public.academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enrollments (Matrículas / Expediente del año)
-- Registra que un alumno está oficialmente inscrito en un ciclo.
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
    
    status enrollment_status DEFAULT 'pending_signature',
    enrollment_date TIMESTAMPTZ DEFAULT now(),
    
    -- Para integración de Firma Digital (CRM)
    contract_url TEXT,
    signature_provider TEXT, -- Ej. 'DocuSign'
    signature_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, term_id) -- Un alumno solo se matricula una vez por ciclo
);

-- 3. Courses (Catálogo de Materias)
-- Ej: "Matemáticas Avanzadas", "Biología I"
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    area TEXT, -- Área curricular (ej. "Humanística", "Científica", "Tecnológica"), para agrupar en la matriz de plan de estudios
    description TEXT,
    credits DECIMAL(3,1),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, code)
);

-- 4. Classes (Grupos / Distributivo Docente)
-- Instancia de un curso en un periodo específico. Ej: "Matemáticas - Grupo A - 2026"
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- FK a perfiles con role='teacher'
    
    name TEXT NOT NULL, -- Ej: "Grupo A", "Tucans"
    grade_section_id UUID REFERENCES public.grade_sections(id) ON DELETE SET NULL, -- A qué grado-sección se dicta este curso (un docente puede tener varios classes: distintos cursos, grados y secciones)
    lms_sync_id TEXT, -- Para sincronizar con Canvas/Google Classroom
    capacity INT DEFAULT 30,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Class Enrollments (Alumnos asignados a Grupos)
-- Relaciona la matrícula del estudiante con sus materias específicas (Libro de notas base).
CREATE TABLE public.class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    
    final_grade DECIMAL(5,2), -- Calificación final del grupo
    lms_sync_status TEXT DEFAULT 'pending',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(class_id, enrollment_id)
);

-- ==========================================
-- ÍNDICES PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_term ON public.enrollments(term_id);
CREATE INDEX idx_classes_teacher ON public.classes(teacher_id);
CREATE INDEX idx_class_enrollments_class ON public.class_enrollments(class_id);

-- ==========================================
-- RLS BÁSICO (Seguridad)
-- ==========================================
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- Los padres solo ven las matrículas de sus propios hijos
CREATE POLICY "Padres ven matriculas de sus hijos"
ON public.enrollments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.parent_students 
        WHERE parent_students.student_id = enrollments.student_id
        AND parent_students.parent_id = auth.uid()
    )
);

-- Profesores ven los grupos que tienen asignados
CREATE POLICY "Docentes ven sus clases"
ON public.classes FOR SELECT USING (
    teacher_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
```
