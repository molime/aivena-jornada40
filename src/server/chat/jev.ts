// Cliente de Jev (TypeSafe AI, modelo "System One") usado como TOOL GATE: evalúa si una
// llamada a herramienta propuesta es una operación riesgosa (write/costosa) antes de ejecutarla.
// Jev no genera texto: recibe un state + preguntas tipadas y devuelve probabilidades calibradas.
// Endpoint confirmado en docs.typesafe.ai: POST https://api.typesafe.ai/v1/systemone
//
// Degradación graceful (mismo patrón que el proyecto front-desk-assignment): sin TYPESAFE_API_KEY
// o con cualquier fallo de red/API, assessRisk devuelve null y el agente aplica la política
// conservadora por defecto (las escrituras siempre piden confirmación).

export interface JevAssessment {
  risky: number; // probabilidad 0..1 de que la llamada sea riesgosa (write/costosa)
  answered: boolean; // false si Jev no estuvo disponible (fallback)
}

export interface JevClient {
  assessRisk(state: string): Promise<JevAssessment | null>;
}

export function getJevConfig() {
  return {
    apiKey: process.env.TYPESAFE_API_KEY ?? null,
    baseUrl: (process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai").replace(/\/$/, ""),
    model: process.env.TYPESAFE_MODEL ?? "jev-latest",
  };
}

export function createJevClient(): JevClient {
  const cfg = getJevConfig();
  return {
    async assessRisk(state: string) {
      if (!cfg.apiKey) return null; // sin key -> política conservadora
      try {
        const res = await fetch(`${cfg.baseUrl}/v1/systemone`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cfg.model,
            state,
            questions: {
              risky: {
                type: "noul",
                instructions:
                  "Executing this tool call would modify stored data, replace existing results, or trigger an expensive recomputation. Is it a write, destructive, or expensive action?",
              },
            },
          }),
        });
        if (!res.ok) return null; // fallo de API/red -> fallback
        const data = await res.json();
        const p = data?.questions?.risky?.noul ?? data?.risky?.noul;
        if (typeof p !== "number") return null;
        return { risky: p, answered: true };
      } catch {
        return null;
      }
    },
  };
}
