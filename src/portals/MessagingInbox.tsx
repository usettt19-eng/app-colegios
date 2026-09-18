import React, { useEffect, useState } from 'react';
import { Inbox, Send, Mail, MailOpen, Loader2, PenSquare, CornerUpLeft, CheckCircle } from 'lucide-react';

interface Conversation {
  id: string;
  subject: string;
  created_by: string;
  is_own: boolean;
  creator_name: string | null;
  participants: string[];
  updated_at: string;
  last_message: string | null;
  is_unread: boolean;
}

interface ThreadMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string };
}

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

type Folder = 'recibidos' | 'enviados';

interface Props {
  tenantId: string;
  profileId: string;
  recipientRole?: 'staff' | 'parent';
}

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Docente',
  admin: 'Administración',
  super_admin: 'Administración',
  parent: 'Padre/Madre',
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const MessagingInbox: React.FC<Props> = ({ tenantId, profileId, recipientRole = 'staff' }) => {
  const [folder, setFolder] = useState<Folder>('recibidos');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [message, setMessage] = useState('');

  const [composing, setComposing] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [composeForm, setComposeForm] = useState({ recipient_id: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/messages/conversations?profile_id=${profileId}`);
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch {
      setMessage('❌ No se pudo conectar con el servidor SIS.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
    fetch(`/api/v1/messages/recipients?tenant_id=${tenantId}&exclude_id=${profileId}&role=${recipientRole}`)
      .then(r => r.json())
      .then(d => setRecipients(d.recipients || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const openConversation = async (id: string) => {
    setSelectedId(id);
    setComposing(false);
    setThreadLoading(true);
    try {
      const response = await fetch(`/api/v1/messages/conversations/${id}?profile_id=${profileId}`);
      const data = await response.json();
      setThread(data.messages || []);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, is_unread: false } : c));
    } catch {
      setMessage('❌ No se pudo cargar la conversación.');
    }
    setThreadLoading(false);
  };

  const handleReply = async () => {
    if (!selectedId || !replyBody.trim()) return;
    setReplying(true);
    try {
      const response = await fetch(`/api/v1/messages/conversations/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: profileId, body: replyBody }),
      });
      const data = await response.json();
      if (data.success) {
        setReplyBody('');
        openConversation(selectedId);
        loadConversations();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo enviar la respuesta.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setReplying(false);
  };

  const handleSendNew = async () => {
    if (!composeForm.recipient_id || !composeForm.subject.trim() || !composeForm.body.trim()) {
      setMessage('❌ Completa destinatario, asunto y mensaje.');
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/v1/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, created_by: profileId, ...composeForm }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ Mensaje enviado.');
        setComposing(false);
        setComposeForm({ recipient_id: '', subject: '', body: '' });
        loadConversations();
      } else {
        setMessage('❌ ' + (data.error || 'No se pudo enviar el mensaje.'));
      }
    } catch {
      setMessage('❌ Error de conexión.');
    }
    setSending(false);
  };

  const filtered = conversations.filter(c => folder === 'enviados' ? c.is_own : !c.is_own);
  const unreadCount = conversations.filter(c => c.is_unread).length;
  const selectedConversation = conversations.find(c => c.id === selectedId);

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg flex items-start border border-indigo-200 break-all">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-sm">{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna izquierda: folders + lista */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-1">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <button
              onClick={() => { setComposing(true); setSelectedId(null); }}
              className="w-full flex items-center justify-center px-3 py-2 bg-teal-600 text-white rounded-md font-semibold text-sm hover:bg-teal-700"
            >
              <PenSquare className="w-4 h-4 mr-2" /> Nuevo Mensaje
            </button>
          </div>
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setFolder('recibidos')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-bold ${folder === 'recibidos' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}
            >
              <Inbox className="w-4 h-4" /> Recibidos
              {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px]">{unreadCount}</span>}
            </button>
            <button
              onClick={() => setFolder('enviados')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-bold ${folder === 'enviados' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}
            >
              <Send className="w-4 h-4" /> Enviados
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">
              {folder === 'recibidos' ? 'No tienes mensajes recibidos.' : 'No has enviado mensajes.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {filtered.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`w-full text-left p-3 hover:bg-slate-50 ${selectedId === conv.id ? 'bg-teal-50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {conv.is_unread ? <Mail className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" /> : <MailOpen className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    <span className={`text-sm truncate ${conv.is_unread ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                      {folder === 'enviados' ? (conv.participants[0] || 'Destinatario') : (conv.creator_name || 'Remitente')}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${conv.is_unread ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>{conv.subject}</p>
                  <p className="text-xs text-slate-400 truncate">{conv.last_message}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">{fmtDateTime(conv.updated_at)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha: hilo / composición */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-2 flex flex-col">
          {composing ? (
            <div className="p-5 space-y-3">
              <h2 className="font-bold text-slate-700 flex items-center"><PenSquare className="w-4 h-4 mr-2 text-teal-600" /> Nuevo Mensaje</h2>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Para</label>
                <select
                  value={composeForm.recipient_id}
                  onChange={e => setComposeForm({ ...composeForm, recipient_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Selecciona un destinatario...</option>
                  {recipients.map(r => (
                    <option key={r.id} value={r.id}>{r.first_name} {r.last_name} ({ROLE_LABELS[r.role] || r.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Asunto</label>
                <input
                  type="text" value={composeForm.subject}
                  onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Mensaje</label>
                <textarea
                  value={composeForm.body}
                  onChange={e => setComposeForm({ ...composeForm, body: e.target.value })}
                  rows={6}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSendNew}
                  disabled={sending}
                  className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 font-semibold text-sm"
                >
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Enviar
                </button>
                <button onClick={() => setComposing(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-md font-semibold text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          ) : !selectedId ? (
            <div className="flex-1 flex items-center justify-center py-24 text-slate-400 text-sm">
              Selecciona una conversación para ver los mensajes.
            </div>
          ) : threadLoading ? (
            <div className="flex-1 flex items-center justify-center py-24 text-slate-400">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Cargando conversación...
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-bold text-slate-700">{selectedConversation?.subject}</h2>
              </div>
              <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto flex-1">
                {thread.map(msg => {
                  const isMine = msg.sender_id === profileId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${isMine ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {!isMine && (
                          <p className="text-xs font-bold mb-0.5 opacity-70">
                            {msg.profiles ? `${msg.profiles.first_name} ${msg.profiles.last_name}` : 'Usuario'}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-teal-100' : 'text-slate-400'}`}>{fmtDateTime(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-slate-100 flex gap-2">
                <input
                  type="text" placeholder="Escribe una respuesta..." value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleReply(); }}
                  className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={handleReply}
                  disabled={replying || !replyBody.trim()}
                  className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 font-semibold text-sm"
                >
                  {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CornerUpLeft className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
