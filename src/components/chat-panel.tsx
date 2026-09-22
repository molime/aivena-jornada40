"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Render mínimo de markdown: **negrita**, *cursiva* y saltos de línea. El LLM responde
// en markdown; sin esto se verían los `**` literales.
function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    return <span key={i}>{part}</span>;
  });
}

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: `⚠ ${data.error ?? "Error del asistente"}` }]);
        if (data.code === "AI_NOT_CONFIGURED") setNotice("Define OPENAI_API_KEY en .env para habilitar el asistente.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠ Error de red al contactar al asistente." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex h-[26rem] w-[22rem] flex-col overflow-hidden rounded-xl border border-overlay bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-overlay px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold">Aurora — asistente IA</div>
              <div className="text-[11px] text-muted">LLM + tool calls + tool gate (Jev)</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted transition-colors hover:text-ink" aria-label="Cerrar chat">
              ✕
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <p className="text-muted">
                Pregunta, por ejemplo: <em className="text-ink">“¿Cuánto ahorramos esta semana?”</em> o{" "}
                <em className="text-ink">“Muéstrame las restricciones validadas”</em>.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 ${
                    m.role === "user"
                      ? "bg-brand font-medium text-black"
                      : "border border-overlay bg-elevated text-ink"
                  }`}
                >
                  {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
                </span>
              </div>
            ))}
            {loading && <p className="text-xs text-muted">pensando…</p>}
            {notice && <p className="text-xs text-warning">{notice}</p>}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-overlay p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre ahorro, tiendas, restricciones…"
              className="flex-1 rounded-lg border border-overlay bg-elevated px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-brand/60"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-brand-strong disabled:opacity-50"
              aria-label="Enviar"
            >
              →
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black shadow-lg transition-colors hover:bg-brand-strong"
      >
        {open ? "Cerrar" : "Asistente IA"}
      </button>
    </div>
  );
}
