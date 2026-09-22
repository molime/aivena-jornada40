// Cliente mínimo OpenAI-compatible (fetch, sin SDK) para el asistente conversacional.
// Configurable vía OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL para cualquier endpoint compatible.
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  // en mensajes assistant con tool_calls: las llamadas que hizo (requerido por OpenAI
  // para que los mensajes 'tool' subsiguientes referencien un tool_call_id válido)
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmReply {
  content: string | null;
  toolCalls: LlmToolCall[];
}

export interface LlmClient {
  chat(input: {
    messages: ChatMessage[];
    tools: { name: string; description: string; parameters: Record<string, unknown> }[];
  }): Promise<LlmReply>;
}

export function getLlmConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY ?? null,
    baseUrl: (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

export function createOpenAiClient(): LlmClient {
  const cfg = getLlmConfig();
  if (!cfg.apiKey) throw new Error("AI_NOT_CONFIGURED");
  return {
    async chat({ messages, tools }) {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          tools: tools.map((t) => ({ type: "function", function: t })),
          tool_choice: "auto",
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      const toolCalls: LlmToolCall[] = (msg?.tool_calls ?? []).map(
        (tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments || "{}"),
        })
      );
      return { content: msg?.content ?? null, toolCalls };
    },
  };
}
