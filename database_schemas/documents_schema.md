# Módulo de Documentos de Admisión y Expediente - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: ADMISSION DOCUMENTS & RECORDS
-- ==========================================

CREATE TYPE document_type AS ENUM (
    'birth_certificate', 
    'previous_transcript', -- Notas del colegio anterior
    'medical_record',      -- Ficha médica / vacunas
    'identity_card',       -- DNI / Pasaporte
    'transfer_certificate',-- Certificado de pase/traslado
    'other'
);

CREATE TYPE document_status AS ENUM ('pending_review', 'approved', 'rejected');

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Student Documents (Repositorio documental del expediente)
CREATE TABLE public.student_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- El padre o el staff
    
    doc_type document_type NOT NULL,
    title TEXT NOT NULL, -- Ej: "Libreta de Notas de 4to Grado - Colegio San Gabriel"
    file_url TEXT NOT NULL, -- Enlace al Storage de Supabase
    
    status document_status DEFAULT 'pending_review',
    reviewer_comments TEXT, -- Si secretaría lo rechaza, pone aquí el por qué
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ÍNDICES PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_student_documents_student ON public.student_documents(student_id, doc_type);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

-- Padres pueden ver y subir documentos de sus propios hijos
CREATE POLICY "Padres gestionan documentos de sus hijos"
ON public.student_documents FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.parent_students 
        WHERE parent_students.student_id = student_documents.student_id
        AND parent_students.parent_id = auth.uid()
    )
);

-- El staff administrativo (Admisiones) puede leer, revisar y aprobar todos
CREATE POLICY "Staff revisa todos los documentos"
ON public.student_documents FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.tenant_id = student_documents.tenant_id
        AND profiles.role IN ('admin', 'super_admin')
    )
);
```
