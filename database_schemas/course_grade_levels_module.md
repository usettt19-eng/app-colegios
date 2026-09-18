# Módulo de Plan de Estudios (Curso ↔ Grado) y Generación Masiva de Grupos

```sql
-- ==========================================
-- SIS MODULE: COURSE ↔ GRADE MAPPING (Plan de Estudios)
-- ==========================================
-- Antes, crear cursos y armar los grupos por sección eran dos pasos
-- totalmente separados: había que crear cada "classes" (grupo) a mano,
-- uno por sección. Esta tabla registra a qué grados aplica un curso, y
-- luego "Generar Grupos" crea automáticamente un grupo por cada sección
-- de esos grados en el periodo elegido.

CREATE TABLE public.course_grade_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES public.grade_levels(id) ON DELETE CASCADE,
    weekly_hours DECIMAL(3,1), -- Horas de clase por semana de este curso EN ESE grado (puede variar entre grados, ej. Matemática 1ro vs 5to)
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(course_id, grade_level_id)
);

CREATE INDEX idx_course_grade_levels_course ON public.course_grade_levels(course_id);
CREATE INDEX idx_course_grade_levels_grade ON public.course_grade_levels(grade_level_id);

ALTER TABLE public.course_grade_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros del colegio leen el plan de estudios"
ON public.course_grade_levels FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.tenant_id = course_grade_levels.tenant_id)
);

CREATE POLICY "Staff administra el plan de estudios de su colegio"
ON public.course_grade_levels FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = course_grade_levels.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- Evita duplicar el mismo grupo (curso + término + sección) si
-- "Generar Grupos" se corre más de una vez para el mismo periodo.
CREATE UNIQUE INDEX idx_classes_unique_group
ON public.classes(term_id, course_id, grade_section_id)
WHERE grade_section_id IS NOT NULL;
```
