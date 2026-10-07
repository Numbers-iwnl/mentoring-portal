import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/assistant-prompt";
import { prisma } from "@/lib/prisma";

/**
 * Chat with the portal's AI assistant.
 * A chave da OpenAI fica só no servidor; o histórico é efêmero (vem do cliente
 * a cada chamada e não é gravado no banco).
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// gpt-5.6-luna: ~40% mais caro que gpt-4o-mini por conversa, mas ainda frações de
// centavo (ver DEPLOY-NOTES.md) e com qualidade bem superior — vale a pena aqui.
const MODEL = process.env.ASSISTANT_MODEL || "gpt-5.6-luna";
// A família gpt-5.x é "reasoning": por padrão ela gasta tokens pensando por baixo dos
// panos, tirados do MESMO orçamento de max_completion_tokens — em perguntas mais abertas
// isso consumia o orçamento inteiro e devolvia uma resposta vazia. "none" desliga esse
// raciocínio oculto (não faz sentido para um chat de suporte/orientação como este) e é o
// que garante resposta visível de verdade. gpt-4o-mini rejeita esse parâmetro com erro 400
// se enviado, então só entra quando o modelo é da família 5.x.
const SUPPORTS_REASONING_EFFORT = MODEL.startsWith("gpt-5");
const MAX_HISTORY = 12;
const MAX_MESSAGE_LENGTH = 2000;
const DAILY_LIMIT = 60;

// Contador diário por usuário, em memória (o portal roda como processo único no
// Hostinger; reiniciar o servidor zera os contadores, o que é aceitável aqui).
const usageByUser = new Map<string, { day: string; count: number }>();

function underDailyLimit(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const entry = usageByUser.get(userId);
  if (!entry || entry.day !== day) {
    usageByUser.set(userId, { day, count: 1 });
    return true;
  }
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count += 1;
  return true;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const messages: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") return null;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) continue;
    messages.push({ role, content: text });
  }
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "membro da equipe administrativa Aurora (usa o painel /admin)",
  STUDENT: "mentorado(a) com acesso completo ao portal",
  STAFF: "funcionário(a) de clínica com acesso limitado"
};

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const userId = typeof token?.sub === "string" ? token.sub : undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true, name: true }
  });
  if (!user?.active) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "unconfigured" }, { status: 503 });

  if (!underDailyLimit(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const messages = parseMessages((body as Record<string, unknown>)?.messages);
  if (!messages) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const contextNote = `Contexto desta conversa: o usuário atual é ${ROLE_LABELS[user.role] ?? "usuário do portal"}. Nome de exibição: ${user.name || "(sem nome)"}.`;

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        // Sem "temperature" de propósito: modelos mais novos (ex.: gpt-5.6-luna) só aceitam
        // o valor padrão e rejeitam a chamada com 400 se outro valor for enviado.
        max_completion_tokens: 700,
        ...(SUPPORTS_REASONING_EFFORT ? { reasoning_effort: "none" } : {}),
        messages: [
          { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
          { role: "system", content: contextNote },
          ...messages
        ]
      }),
      signal: AbortSignal.timeout(45_000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Assistant: OpenAI respondeu erro", response.status, detail.slice(0, 500));
      // Conta OpenAI sem créditos/cota — problema de cobrança, não de código.
      if (detail.includes("insufficient_quota") || detail.includes("credit_balance_exhausted")) {
        return NextResponse.json({ error: "no_credits" }, { status: 502 });
      }
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: "empty" }, { status: 502 });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Assistant: falha ao chamar OpenAI", error);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
