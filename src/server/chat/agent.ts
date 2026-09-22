// Bucle del agente conversacional: LLM (razonamiento/lenguaje) -> tool calls -> Jev (tool gate)
// -> ejecución contra datos reales -> respuesta final. El solver sigue siendo determinista;
// esta capa solo INTERPRETA datos existentes y, con confirmación, dispara recomputaciones.
import { TOOL_DEFS, ToolContext, executeTool } from "./tools";
import { ChatMessage, LlmClient } from "./llm";
import { JevClient } from "./jev";

const SYSTEM_PROMPT = `Eres "Aurora", la asistente de JORNADA40, la herramienta de programación semanal de personal retail bajo el tope de 40 horas (reforma mexicana "Jornada 40").

Reglas:
- Responde SIEMPRE con cifras reales obtenidas mediante tool calls; nunca inventes números.
- Moneda: pesos mexicanos (MXN) por semana. Sé conciso y directo, en español.
- run_scheduler recomputa la programación de todas las tiendas y reemplaza las corridas vigentes: solo puedes llamarlo con confirm=true cuando el usuario lo confirme explícitamente.
- Si una llamada es bloqueada por el gate, explica al usuario que necesitas su confirmación para ejecutarla.`;

export interface AgentDeps {
  llm: LlmClient;
  jev: JevClient | null;
  toolCtx: ToolContext;
}

export interface AgentResult {
  reply: string;
  meta: { iterations: number; toolCalls: string[]; jevUsed: boolean };
}

const MAX_ITERATIONS = 6;

function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content ?? "";
  }
  return "";
}

export async function runAgent(messages: ChatMessage[], deps: AgentDeps): Promise<AgentResult> {
  const transcript: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
  const toolCallsMade: string[] = [];
  let jevUsed = false;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const reply = await deps.llm.chat({ messages: transcript, tools: TOOL_DEFS });

    if (reply.toolCalls.length === 0) {
      return {
        reply: reply.content ?? "(sin respuesta)",
        meta: { iterations: iter + 1, toolCalls: toolCallsMade, jevUsed },
      };
    }

    // Ejecutar todas las tool calls del turno y reunir los resultados.
    const toolResults: { tc: (typeof reply.toolCalls)[number]; result: string }[] = [];
    for (const tc of reply.toolCalls) {
      toolCallsMade.push(tc.name);
      const def = TOOL_DEFS.find((t) => t.name === tc.name);

      let result: string;
      if (!def) {
        result = `Herramienta desconocida: ${tc.name}`;
      } else if (def.write) {
        // TOOL GATE (Jev): ¿la llamada propuesta es riesgosa? Fallback sin Jev: siempre confirmar.
        const assessment = deps.jev
          ? await deps.jev.assessRisk(
              JSON.stringify({ userRequest: lastUserMessage(messages), tool: tc.name, args: tc.args })
            )
          : null;
        if (assessment?.answered) jevUsed = true;

        const needsConfirm = assessment ? assessment.risky > 0.5 : true;
        if (needsConfirm && tc.args.confirm !== true) {
          result =
            `BLOQUEADO por el gate de seguridad${assessment?.answered ? ` (Jev: ${(assessment.risky * 100).toFixed(0)}% riesgo)` : " (política conservadora: Jev no disponible)"}. ` +
            `run_scheduler reemplaza las corridas vigentes: pide al usuario que confirme explícitamente y vuelva a llamar con confirm=true.`;
        } else {
          result = await executeTool(tc.name, tc.args, deps.toolCtx);
          if (assessment?.answered && !needsConfirm) {
            result += `\n(Autorizado por Jev sin confirmación: riesgo ${(assessment.risky * 100).toFixed(0)}%)`;
          }
        }
      } else {
        result = await executeTool(tc.name, tc.args, deps.toolCtx);
      }
      toolResults.push({ tc, result });
    }

    // Un ÚNICO mensaje assistant que lleva tool_calls (OpenAI lo exige) seguido de los resultados.
    transcript.push({
      role: "assistant",
      content: reply.content ?? null,
      tool_calls: reply.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    });
    for (const { tc, result } of toolResults) {
      transcript.push({ role: "tool", content: result, tool_call_id: tc.id, name: tc.name });
    }
  }

  return {
    reply: "No pude completar la respuesta en el número máximo de pasos. Intenta de nuevo con una pregunta más específica.",
    meta: { iterations: MAX_ITERATIONS, toolCalls: toolCallsMade, jevUsed },
  };
}
