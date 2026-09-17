-- Actualización al esquema de Perfiles para Estructura Jerárquica

-- 1. Añadimos Departamentos Académicos/Administrativos
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Ej: 'Ciencias', 'Dirección', 'Matemáticas'
    head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- El Director del departamento
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Modificamos la tabla de perfiles (staff) para soportar Jerarquía Organizacional
ALTER TABLE public.profiles 
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN reports_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL; -- ¿A quién le rinde cuentas? (Estructura de Árbol)
