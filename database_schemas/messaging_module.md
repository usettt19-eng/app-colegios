# Módulo de Mensajería Interna (Bandeja de Entrada) - Esquema SQL

```sql
-- ==========================================
-- SIS MODULE: INTERNAL MESSAGING (Inbox)
-- ==========================================
-- Mensajería 1:1 (o con varios participantes) entre padres y staff,
-- organizada en conversaciones con hilo de mensajes, a diferencia de los
-- comunicados masivos del módulo de Communications (broadcast).

-- ==========================================
-- TABLAS
-- ==========================================

-- 1. Conversations (Hilo de mensajería)
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Conversation Participants (Quién puede ver el hilo y cuándo lo leyó)
CREATE TABLE public.conversation_participants (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ,

    PRIMARY KEY (conversation_id, profile_id)
);

-- 3. Messages (Mensajes individuales dentro del hilo)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ÍNDICES PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_conversation_participants_profile ON public.conversation_participants(profile_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_conversations_tenant_updated ON public.conversations(tenant_id, updated_at DESC);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes ven sus conversaciones"
ON public.conversations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.profile_id = auth.uid()
    )
);

CREATE POLICY "Participantes ven la lista de participantes de sus conversaciones"
ON public.conversation_participants FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants cp2
        WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.profile_id = auth.uid()
    )
);

CREATE POLICY "Participantes ven y envían mensajes en sus conversaciones"
ON public.messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_participants.conversation_id = messages.conversation_id
        AND conversation_participants.profile_id = auth.uid()
    )
);

CREATE POLICY "Participantes envían mensajes en sus conversaciones"
ON public.messages FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_participants.conversation_id = messages.conversation_id
        AND conversation_participants.profile_id = auth.uid()
    )
);
```
