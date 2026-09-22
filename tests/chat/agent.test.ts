// Tests del agente conversacional con fakeLlm (mismo patrón que harness/ de front-desk-assignment):
// un LLM scriptado responde secuencias prefijadas y los tool calls corren contra implementaciones
// reales sobre una base de datos trampa (throwaway fake). Las assertions son estructurales:
// ¿se llamó la herramienta?, ¿se ejecutó la escritura?, ¿el gate bloqueó/aprobó?
import { describe, it, expect, vi } from "vitest";
import { runAgent, AgentDeps } from "@/server/chat/agent";
import { ChatMessage, LlmReply } from "@/server/chat/llm";
import { JevClient } from "@/server/chat/jev";
import type { PrismaClient } from "@prisma/client";

// ---------- fake db (throwaway) ----------
const RUN = {
  id: "run-1",
  storeId: "store-1",
  baselineCost: 41172,
  proposedCost: 29092,
  savings: 12080,
  savingsPercent: 0.2934,
  savingsOvertime: 3132,
  savingsOverstaffing: 9788,
  savingsSunday: -840,
  valid: true,
  store: { name: "Tienda Aurora — CDMX Centro" },
  traces: [
    {
      code: "MAX_WEEKLY_HOURS",
      description: "Ningún empleado supera 40 horas semanales",
      source: "LFT art. 61",
      result: "PASS — máximo observado: 40h/semana",
      passed: true,
    },
  ],
};

function fakeDb() {
  return {
    scheduleRun: { findMany: vi.fn().mockResolvedValue([RUN]) },
    store: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "store-1", name: "Tienda Aurora — CDMX Centro", _count: { employees: 15 } }]),
    },
    employee: { count: vi.fn().mockResolvedValue(15) },
  } as unknown as PrismaClient;
}

// ---------- fake LLM scriptado ----------
function fakeLlm(script: LlmReply[]) {
  const calls: { messages: ChatMessage[] }[] = [];
  return {
    calls,
    client: {
      async chat(input: { messages: ChatMessage[] }) {
        calls.push({ messages: input.messages });
        const next = script.shift();
        if (!next) throw new Error("fakeLlm: script agotado");
        return next;
      },
    },
  };
}

function toolCall(name: string, args: Record<string, unknown> = {}): LlmReply {
  return { content: null, toolCalls: [{ id: `call-${name}`, name, args }] };
}

const USER: ChatMessage[] = [{ role: "user", content: "¿Cuánto ahorramos?" }];

function makeDeps(script: LlmReply[], jev: JevClient | null, runScheduler = vi.fn().mockResolvedValue([])) {
  const llm = fakeLlm(script);
  const deps: AgentDeps = {
    llm: llm.client,
    jev,
    toolCtx: { db: fakeDb(), runScheduler },
  };
  return { deps, llm, runScheduler };
}

const jevWith = (risky: number): JevClient => ({
  assessRisk: async () => ({ risky, answered: true }),
});

describe("agente conversacional (fakeLlm)", () => {
  it("responde una pregunta de ahorro usando tool calls con datos reales", async () => {
    const { deps, llm } = makeDeps(
      [toolCall("get_savings_summary"), { content: "Ahorramos $12,080 MXN por semana.", toolCalls: [] }],
      null
    );
    const result = await runAgent(USER, deps);
    expect(result.reply).toContain("$12,080");
    expect(result.meta.toolCalls).toEqual(["get_savings_summary"]);
    // el LLM recibió el resultado de la herramienta en el transcript
    const lastMessages = llm.calls[1].messages;
    const toolMsg = lastMessages.find((m) => m.role === "tool");
    expect(toolMsg?.content).toContain("$12,080");
    expect(toolMsg?.content).toContain("29.3%");
  });

  it("las herramientas de lectura no pasan por el gate", async () => {
    const jev = jevWith(0.99);
    const { deps } = makeDeps(
      [toolCall("get_constraint_traces"), { content: "Todas las restricciones en PASS.", toolCalls: [] }],
      jev
    );
    const result = await runAgent(USER, deps);
    expect(result.meta.toolCalls).toEqual(["get_constraint_traces"]);
    expect(result.meta.jevUsed).toBe(false); // Jev solo evalúa escrituras
    expect(result.reply).toContain("PASS");
  });

  it("run_scheduler SIN confirm se ejecuta cuando Jev lo aprueba (riesgo bajo)", async () => {
    const { deps, runScheduler } = makeDeps(
      [
        toolCall("run_scheduler"),
        { content: "Listo, reprogramé todas las tiendas.", toolCalls: [] },
      ],
      jevWith(0.1) // Jev: bajo riesgo -> el gate autoriza sin confirmación
    );
    const result = await runAgent(USER, deps);
    expect(runScheduler).toHaveBeenCalledTimes(1);
    expect(result.meta.jevUsed).toBe(true);
  });

  it("run_scheduler SIN confirm es bloqueado cuando Jev lo marca riesgoso", async () => {
    const { deps, runScheduler } = makeDeps(
      [
        toolCall("run_scheduler"),
        { content: "Necesito tu confirmación para recomputar la programación.", toolCalls: [] },
      ],
      jevWith(0.95)
    );
    const result = await runAgent(USER, deps);
    expect(runScheduler).not.toHaveBeenCalled();
    expect(result.meta.toolCalls).toEqual(["run_scheduler"]);
  });

  it("run_scheduler CON confirm=true se ejecuta cuando Jev lo marca riesgoso", async () => {
    const { deps, runScheduler } = makeDeps(
      [
        toolCall("run_scheduler", { confirm: true }),
        { content: "Listo, reprogramé todas las tiendas.", toolCalls: [] },
      ],
      jevWith(0.95)
    );
    const result = await runAgent(USER, deps);
    expect(runScheduler).toHaveBeenCalledTimes(1);
    expect(result.meta.jevUsed).toBe(true);
  });

  it("fallback sin Jev: escritura exige confirm; con confirm se ejecuta", async () => {
    const blocked = makeDeps(
      [toolCall("run_scheduler"), { content: "confirmas?", toolCalls: [] }],
      null // Jev no disponible -> política conservadora
    );
    await runAgent(USER, blocked.deps);
    expect(blocked.runScheduler).not.toHaveBeenCalled();

    const allowed = makeDeps(
      [toolCall("run_scheduler", { confirm: true }), { content: "ok", toolCalls: [] }],
      null
    );
    await runAgent(USER, allowed.deps);
    expect(allowed.runScheduler).toHaveBeenCalledTimes(1);
  });

  it("un maxIterations evita loops infinitos de tool calls", async () => {
    const script = Array.from({ length: 10 }, () => toolCall("get_savings_summary"));
    const { deps } = makeDeps(script, null);
    const result = await runAgent(USER, deps);
    expect(result.meta.iterations).toBeLessThanOrEqual(6);
  });
});
