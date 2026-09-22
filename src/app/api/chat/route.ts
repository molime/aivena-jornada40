import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runSchedulerForAllStores } from "@/server/run-scheduler";
import { runAgent } from "@/server/chat/agent";
import { createOpenAiClient, ChatMessage } from "@/server/chat/llm";
import { createJevClient } from "@/server/chat/jev";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 24;

// POST /api/chat — asistente conversacional (LLM + tool calls + tool gate Jev).
// Degradación graceful: sin OPENAI_API_KEY responde 503 con mensaje claro; el resto de la
// app funciona igual (mismo patrón que front-desk-assignment).
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const messages = (body.messages ?? []).slice(-MAX_MESSAGES).filter(
    (m) =>
      m &&
      typeof m.content === "string" &&
      ["user", "assistant", "tool"].includes(m.role) &&
      m.content.length < 4000
  );
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Se esperaba al menos un mensaje del usuario" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Asistente IA no configurado: define OPENAI_API_KEY en .env para habilitarlo. La herramienta funciona sin él.",
        code: "AI_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  try {
    const result = await runAgent(messages, {
      llm: createOpenAiClient(),
      jev: createJevClient(),
      toolCtx: { db, runScheduler: runSchedulerForAllStores },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error del asistente" },
      { status: 500 }
    );
  }
}
