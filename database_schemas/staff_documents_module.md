# Módulo de Expediente Documental del Staff/Docentes - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: STAFF/TEACHER DOCUMENT RECORDS
-- ==========================================
-- Igual que student_documents, pero para el expediente de un miembro del
-- staff (docente, admin, guardia): títulos, certificaciones, hoja de
-- vida, cartas de experiencia laboral, antecedentes, contrato, etc.

CREATE TYPE staff_document_type AS ENUM (
    'degree',            -- Título / diploma
    'certification',     -- Certificación / curso
    'cv',                -- Hoja de vida / currículum
    'experience_letter', -- Carta de experiencia laboral
    'background_check',  -- Certificado de antecedentes
    'id_document',        -- Cédula / pasaporte
    'contract',          -- Contrato laboral
    'other'
);

-- Reutiliza el enum document_status ('pending_review', 'approved', 'rejected')
-- ya creado en documents_schema.md.

CREATE TABLE public.staff_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    doc_type staff_document_type NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL, -- Enlace al Storage de Supabase

    status document_status DEFAULT 'pending_review',
    reviewer_comments TEXT,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_documents_profile ON public.staff_documents(profile_id, doc_type);

ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;

-- El docente/staff ve y sube sus propios documentos
CREATE POLICY "Docentes ven y suben sus propios documentos"
ON public.staff_documents FOR ALL USING (profile_id = auth.uid());

-- Admin del colegio administra el expediente de todo su staff
CREATE POLICY "Admins gestionan documentos de su staff"
ON public.staff_documents FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = staff_documents.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);
```
