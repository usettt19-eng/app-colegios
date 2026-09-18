import { Request, Response, Router } from "express";
import { supabaseAdmin } from "../supabase";

const router = Router();

// GET /api/v1/messages/recipients?tenant_id=...&exclude_id=...&role=parent|staff
// Lista los posibles destinatarios para el selector de "Nuevo Mensaje".
// - role=staff (o sin especificar, para compatibilidad con el Portal de Padres):
//   admin/super_admin/teacher del colegio.
// - role=parent (usado por el Portal del Docente, para escribirle a un padre):
//   todos los perfiles con role='parent' del colegio.
router.get("/recipients", async (req: Request, res: Response) => {
  try {
    const { tenant_id, exclude_id, role } = req.query;
    if (!tenant_id) return res.status(400).json({ error: "Falta tenant_id" });

    const roles = role === "parent" ? ["parent"] : ["admin", "super_admin", "teacher"];

    let query = supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, role")
      .eq("tenant_id", tenant_id)
      .in("role", roles);

    if (exclude_id) query = query.neq("id", exclude_id);

    const { data, error } = await query.order("first_name");

    if (error) return res.status(500).json({ error: "Error al consultar los destinatarios." });
    return res.status(200).json({ success: true, recipients: data });
  } catch (error: any) {
    console.error("Error en GET /api/v1/messages/recipients:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/messages/conversations?profile_id=...
// Bandeja de entrada: lista las conversaciones del usuario con el último
// mensaje, el/los otros participantes y si tiene mensajes sin leer.
router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const { profile_id } = req.query;
    if (!profile_id) return res.status(400).json({ error: "Falta profile_id" });

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("profile_id", profile_id);

    if (membershipError) return res.status(500).json({ error: "Error al consultar la bandeja de mensajes." });
    if (!memberships || memberships.length === 0) return res.status(200).json({ success: true, conversations: [] });

    const conversationIds = memberships.map(m => m.conversation_id);
    const readByConversation: Record<string, string | null> = {};
    memberships.forEach(m => { readByConversation[m.conversation_id] = m.last_read_at; });

    const { data: conversations, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("id, subject, created_by, created_at, updated_at, profiles!conversations_created_by_fkey(first_name, last_name)")
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });

    if (convError) return res.status(500).json({ error: "Error al consultar las conversaciones." });

    const { data: participants } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id, profiles(id, first_name, last_name)")
      .in("conversation_id", conversationIds);

    const result = await Promise.all((conversations || []).map(async (conv: any) => {
      const { data: lastMessage } = await supabaseAdmin
        .from("messages")
        .select("body, sender_id, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastReadAt = readByConversation[conv.id];
      const isUnread = !!lastMessage && lastMessage.sender_id !== profile_id &&
        (!lastReadAt || new Date(lastMessage.created_at) > new Date(lastReadAt));

      const others = (participants || [])
        .filter((p: any) => p.conversation_id === conv.id && p.profiles?.id !== profile_id)
        .map((p: any) => `${p.profiles?.first_name || ""} ${p.profiles?.last_name || ""}`.trim());

      return {
        id: conv.id,
        subject: conv.subject,
        created_by: conv.created_by,
        is_own: conv.created_by === profile_id,
        creator_name: conv.profiles ? `${conv.profiles.first_name} ${conv.profiles.last_name}` : null,
        participants: others,
        updated_at: conv.updated_at,
        last_message: lastMessage?.body || null,
        is_unread: isUnread,
      };
    }));

    return res.status(200).json({ success: true, conversations: result });
  } catch (error: any) {
    console.error("Error en GET /api/v1/messages/conversations:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/v1/messages/conversations/:id?profile_id=...
// Trae el hilo completo de mensajes y marca la conversación como leída
// para ese participante.
router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { profile_id } = req.query;
    if (!profile_id) return res.status(400).json({ error: "Falta profile_id" });

    const { data: membership } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", id)
      .eq("profile_id", profile_id)
      .maybeSingle();

    if (!membership) return res.status(403).json({ error: "No tienes acceso a esta conversación." });

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id, subject, created_at")
      .eq("id", id)
      .single();

    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, body, created_at, profiles(first_name, last_name)")
      .eq("conversation_id", id)
      .order("created_at");

    if (error) return res.status(500).json({ error: "Error al consultar los mensajes." });

    await supabaseAdmin
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("profile_id", profile_id);

    return res.status(200).json({ success: true, conversation, messages });
  } catch (error: any) {
    console.error("Error en GET /api/v1/messages/conversations/:id:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/messages/conversations
// Inicia una nueva conversación (compone un mensaje nuevo)
router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const { tenant_id, created_by, recipient_id, subject, body } = req.body;

    if (!tenant_id || !created_by || !recipient_id || !subject || !body) {
      return res.status(400).json({ error: "Faltan parámetros requeridos." });
    }

    const { data: conversation, error: convError } = await supabaseAdmin
      .from("conversations")
      .insert({ tenant_id, subject, created_by })
      .select()
      .single();

    if (convError || !conversation) {
      console.error("Error al crear conversación:", convError);
      return res.status(500).json({ error: "No se pudo iniciar la conversación." });
    }

    await supabaseAdmin.from("conversation_participants").insert([
      { conversation_id: conversation.id, profile_id: created_by, last_read_at: new Date().toISOString() },
      { conversation_id: conversation.id, profile_id: recipient_id },
    ]);

    const { data: message, error: msgError } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: created_by, body })
      .select()
      .single();

    if (msgError) {
      console.error("Error al enviar el primer mensaje:", msgError);
      return res.status(500).json({ error: "No se pudo enviar el mensaje." });
    }

    return res.status(201).json({ success: true, message: "Mensaje enviado.", conversation, firstMessage: message });
  } catch (error: any) {
    console.error("Error en POST /api/v1/messages/conversations:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/v1/messages/conversations/:id/reply
// Responde dentro de una conversación existente
router.post("/conversations/:id/reply", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sender_id, body } = req.body;

    if (!sender_id || !body) return res.status(400).json({ error: "Faltan parámetros requeridos." });

    const { data: membership } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", id)
      .eq("profile_id", sender_id)
      .maybeSingle();

    if (!membership) return res.status(403).json({ error: "No tienes acceso a esta conversación." });

    const { data: message, error } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: id, sender_id, body })
      .select()
      .single();

    if (error || !message) return res.status(500).json({ error: "No se pudo enviar la respuesta." });

    await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
    await supabaseAdmin
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("profile_id", sender_id);

    return res.status(201).json({ success: true, message: "Respuesta enviada.", newMessage: message });
  } catch (error: any) {
    console.error("Error en POST /api/v1/messages/conversations/:id/reply:", error);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
