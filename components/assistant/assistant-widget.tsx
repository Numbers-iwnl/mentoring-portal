"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const GREETING =
  "Oi! Eu sou a assistente virtual do portal — uma IA treinada para te ajudar. Posso explicar qualquer tela do portal (vendas, mensagens, importações...) e tirar dúvidas sobre como registrar o dia a dia da clínica. O que você precisa?";

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: "Você atingiu o limite de mensagens de hoje. Tente novamente amanhã!",
  unconfigured: "O assistente ainda não está configurado neste ambiente. Avise a equipe Aurora.",
  no_credits: "O assistente está temporariamente indisponível. A equipe Aurora já pode resolver isso (créditos da conta de IA).",
  default: "Não consegui responder agora. Tente de novo em instantes — se continuar, avise a equipe Aurora."
};

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });
      const data = (await response.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (response.ok && data.reply) {
        setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      } else {
        const friendly = ERROR_MESSAGES[data.error ?? ""] ?? ERROR_MESSAGES.default;
        setMessages([...nextMessages, { role: "assistant", content: friendly }]);
      }
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: ERROR_MESSAGES.default }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-4 right-4 z-40 flex h-[min(34rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-graphite-950/15 bg-white shadow-luxury">
          <div className="flex items-center gap-3 border-b border-white/10 bg-graphite-950 px-4 py-3 text-ivory">
            {/* eslint-disable-next-line @next/next/no-img-element -- convenção do projeto (mesma dos logos em brand.tsx) */}
            <img src="/assistant.png" alt="" className="h-9 w-9 shrink-0 rounded-full bg-white object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Assistente virtual</p>
              <p className="flex items-center gap-1 text-[11px] text-ivory/60">
                <Sparkles size={11} />
                Assistente virtual (IA)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="rounded-md p-1.5 text-ivory/70 transition hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-ivory/60 p-4">
            <Bubble role="assistant">{GREETING}</Bubble>
            {messages.map((message, index) => (
              <Bubble key={index} role={message.role}>
                {message.content}
              </Bubble>
            ))}
            {sending ? (
              <Bubble role="assistant">
                <span className="inline-flex items-center gap-1.5 text-graphite-700/70">
                  <span className="typing-dot" />
                  <span className="typing-dot [animation-delay:150ms]" />
                  <span className="typing-dot [animation-delay:300ms]" />
                </span>
              </Bubble>
            ) : null}
          </div>

          <form
            className="flex items-center gap-2 border-t border-graphite-950/10 bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={2000}
              placeholder="Escreva sua dúvida..."
              className="h-10 min-w-0 flex-1 rounded-md border border-[rgba(0,6,35,0.12)] bg-white px-3 text-sm text-ink outline-none transition placeholder:text-graphite-700/40 focus:border-champagne-500 focus:ring-2 focus:ring-[rgba(152,178,196,0.24)]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Enviar mensagem"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-r from-white to-champagne-300 text-graphite-950 shadow-soft transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send size={16} />
            </button>
          </form>
          <p className="border-t border-[rgba(0,6,35,0.08)] bg-white px-3 py-1.5 text-center text-[10px] leading-4 text-graphite-700/55">
            Respostas geradas por IA — podem conter erros. Não substitui orientação clínica.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente virtual"
          className="group fixed bottom-28 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-graphite-950 shadow-luxury transition hover:scale-105 hover:bg-graphite-900 active:translate-y-px active:scale-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- convenção do projeto (mesma dos logos em brand.tsx) */}
          <img src="/assistant.png" alt="" className="h-11 w-11 rounded-full bg-white object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-graphite-950 bg-champagne-500 text-graphite-950">
            <MessageCircle size={11} strokeWidth={2.5} />
          </span>
          <span className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-graphite-950 px-2.5 py-1.5 text-xs font-semibold text-ivory shadow-luxury group-hover:block">
            Dúvidas? Fale com a IA
          </span>
        </button>
      )}
    </>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-graphite-950 px-3.5 py-2.5 text-sm leading-relaxed text-ivory"
            : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-graphite-950/10 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink shadow-sm"
        }
      >
        {typeof children === "string" ? renderBold(children) : children}
      </div>
    </div>
  );
}

/** O modelo às vezes usa **negrito** estilo markdown; a bolha é texto puro, então convertemos em <strong>. */
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}
