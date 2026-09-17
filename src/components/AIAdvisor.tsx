import React, { useState, useRef, useEffect } from "react";
import { AIChatMessage } from "../types";
import { Cpu, Send, Sparkles, MessageSquare, BookOpen, AlertCircle, Calendar } from "lucide-react";

const PRESET_QUESTIONS = [
  {
    text: "Malla Curricular Dual",
    prompt: "¿Cómo diseño el libro de calificaciones y las tablas de base de datos para soportar tanto promedios K-12 (escala de 10) como créditos y GPA universitarios en una misma base de datos?",
    icon: <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
  },
  {
    text: "Algoritmo de Horarios",
    prompt: "¿Cuáles son las mejores prácticas para diseñar el distributivo de horarios docente y aulas (Master Schedule Builder) sin solapamiento? ¿Podrías darme un modelo de datos o restricciones lógicas?",
    icon: <Calendar className="w-3.5 h-3.5 text-orange-400" />
  },
  {
    text: "Leyes y Privacidad",
    prompt: "¿Cómo garantizo el cumplimiento regulatorio de leyes de privacidad estudiantil (GDPR / FERPA) al diseñar el sistema de alertas automáticas SMS de inasistencia familiar?",
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
  }
];

export default function AIAdvisor() {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: "model",
      content: "¡Hola! Soy tu **Asesor de Arquitectura EdTech y Diseñador de Productos SIS/ERP Escolar**. \n\nPuedo ayudarte a detallar los módulos core, sugerir esquemas de bases de datos complejos, proponer integraciones con LMS o redactar controladores de Express listos para producción. ¿Qué componente arquitectónico te gustaría diseñar hoy?"
    }
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: AIChatMessage = { role: "user", content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      // Create history list omitting the current user message
      const history = messages.slice(1);

      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, history }),
      });

      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { role: "model", content: `🚨 **Error de API:** ${data.error}` }]);
      } else {
        setMessages(prev => [...prev, { role: "model", content: data.answer }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "model", content: "🚨 **Error de red:** No se pudo establecer conexión con el consultor de IA." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-advisor" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[500px]">
      {/* Sidebar: Recommended prompts */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Preguntas Frecuentes de Arquitectura</h3>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal mb-4">
            Selecciona una consulta común de diseño o escribe tus propias dudas de ingeniería escolar en el chat.
          </p>

          <div className="space-y-2.5">
            {PRESET_QUESTIONS.map((q) => (
              <button
                key={q.text}
                onClick={() => handleSendMessage(q.prompt)}
                disabled={loading}
                className="w-full text-left p-3 bg-slate-950/40 hover:bg-slate-950 hover:border-slate-600 transition-all border border-slate-800 rounded-xl flex gap-3 cursor-pointer disabled:opacity-50 group"
              >
                <div className="p-1.5 rounded-lg bg-slate-900 shrink-0 self-start">
                  {q.icon}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-300 group-hover:text-indigo-300 transition-colors">{q.text}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-normal">{q.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-[10px] leading-normal flex items-start gap-1.5 shrink-0">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Alimentado por <strong>Gemini 3.8 Flash</strong>. Diseñado para proporcionar fragmentos de código, consultas SQL válidas y consejos de interoperabilidad escolar.</span>
        </div>
      </div>

      {/* Main chat window */}
      <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        {/* Chat message listing */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 h-[350px]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-[85%] ${
                m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              <div className={`p-1.5 h-7 w-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 uppercase select-none ${
                m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-850 text-indigo-400 border border-slate-750"
              }`}>
                {m.role === "user" ? "U" : "AI"}
              </div>

              <div className={`p-3 rounded-2xl text-xs leading-relaxed overflow-hidden whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none font-medium"
                  : "bg-slate-950 text-slate-300 border border-slate-850 rounded-tl-none markdown-container"
              }`}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-[85%] mr-auto">
              <div className="p-1.5 h-7 w-7 rounded-full bg-slate-850 text-indigo-400 border border-slate-750 flex items-center justify-center text-xs font-extrabold animate-pulse">
                AI
              </div>
              <div className="p-3 bg-slate-950 text-slate-400 border border-slate-850 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-[11px] italic">Consultando con el arquitecto principal EdTech...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Text Input area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="flex gap-2 shrink-0 border-t border-slate-800 pt-3"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            placeholder="Pregunta sobre DDL de Postgres, Canvas LMS LTI 1.3, o cálculos de mora..."
            className="flex-1 bg-slate-950 text-xs text-slate-300 p-2.5 rounded-lg border border-slate-800 outline-none focus:border-indigo-500 placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-indigo-300 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Preguntar
          </button>
        </form>
      </div>
    </div>
  );
}
