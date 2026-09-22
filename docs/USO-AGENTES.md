# Registro de uso de herramientas agénticas (evidencia del proceso)

> Requisito del reto: "el registro de cómo usaste herramientas agénticas". Este documento se actualiza a
> lo largo del desarrollo.

## Stack de herramientas agénticas utilizado

- **Kimi Code CLI** — agente principal de desarrollo: diseño en conversación, implementación,
  tests, refactor y QA, con subagentes para exploración paralela.
- **Conclave** — orquestador multi-agente (council planning → implementación → revisión por jury
  → fix, con quality gates): usado para planificación en consejo de decisiones de arquitectura
  no triviales y para revisiones por jury de los módulos críticos antes de darlos por cerrados.
- **Agent-memory** — memoria persistente entre sesiones: conservó el log de decisiones (D1–D12),
  las fuentes de las restricciones (LFT art. 61/69, reglas operativas) y el estado de cada
  sesión, de modo que cada sesión nueva retomó con contexto completo en lugar de rederivarlo.

## 2026-09-21 · Sesión 1 (Kimi Code CLI, agente principal + subagentes)

- **Lectura y análisis del brief del reto**: a partir del documento se definieron los requisitos
  (tope 40h, ahorro en MXN, escala ~50 tiendas × ~80 FTE, ≥8% de ahorro sin subdotación en picos)
  y la decisión de datos: 100% sintéticos, retailer ficticio «Tienda Aurora» — ver
  `docs/DECISIONES.md §1.1`.
- **Planificación en consejo (Conclave)**: antes de escribir código se corrió una pasada de
  planning con council sobre el enfoque del solver (greedy con validación dura vs. ILP con
  OR-Tools vs. programación dinámica). Salida: la decisión D4 (módulo TS puro determinista) con
  sus razones de reproducibilidad y auditabilidad, que quedó fijada en `docs/DECISIONES.md`.
- **Memoria de sesión (agent-memory)**: registradas las entidades del dominio (tienda, empleado,
  tráfico, corrida, traza) y las restricciones duras identificadas en el PDF, como contexto base
  para las sesiones siguientes.
- **Diseño**: redacción de `docs/DECISIONES.md` (decisiones D1–D9, diseño de dominio, flujo, estructura
  de carpetas, etapas, prompt reutilizable) y `docs/SUPUESTOS.md`.
- **Scaffold**: `create-next-app` (Next.js 15, TS, Tailwind, App Router, src/) ejecutado en background.

## Sesión 1 · Continuación (implementación)

- **Solver (núcleo del reto)**: módulo TypeScript puro en `src/lib/solver/` (demanda por niveles,
  turnos 4/6/8h, asignación greedy con restricciones duras, validación y trazabilidad) +
  motor de costos MXN en `src/lib/cost.ts` (h.extra 1.5x, prima dominical 25%).
- **Datos**: generador sintético determinista (`src/lib/seed-data.ts`, seed 4242, retailer
  ficticio «Tienda Aurora»); schema Prisma + seed idempotente con usuario demo.
- **Decisiones de implementación tomadas en caliente**:
  - *Prisma 6 LTS en vez de 7*: npm resolvió `@prisma/client@7`, cuyo cliente nuevo (query
    compiler + driver adapters) rompe el flujo documentado con Better Auth; se fijó Prisma 6.19
    para eliminar riesgo en la deadline. Upgrade path documentado en DECISIONES.md.
  - *Better Auth exige `account.accountId == user.id`* para el provider "credential"
    (descubierto leyendo `sign-in.mjs` tras un login rechazado en el smoke test E2E).
- **Verificación**:
  - `vitest`: 11/11 PASS (cap 40h, ≥1 día de descanso, cobertura ≥ demanda en picos,
    ≥8% de ahorro por tienda, 0 h.extra en propuesta, desglose del ahorro cuadra, trazas PASS).
  - `scripts/verify.ts` (sin DB): 3×15 → **30.7%** de ahorro; escala del enunciado 50×80 →
    **35.6%**; restricciones duras TODAS EN PASS en ambos casos. (Se corrigió la escala:
    la curva de tráfico ahora escala con la plantilla para no distorsionar el porcentaje.)
  - E2E contra build de producción (`npm start` + curl): `/` redirige a `/login` sin sesión;
    sign-in con `admin@demo.mx / demo1234` OK; `POST /api/schedule/run` persiste corridas
    (3/3 tiendas válidas, ahorro 29.3% promedio); `/dashboard`, `/tiendas`, `/tiendas/[id]`,
    `/restricciones` responden 200 con datos reales (KPIs $38,062 / 30.7% / 0 violaciones;
    4 códigos de restricción × 3 tiendas en PASS).
  - `npm run lint` y `npm run build` en verde (Next.js 16.3.5).
- **Revisión por jury (Conclave)**: el núcleo del solver (`src/lib/solver/`) y el motor de costos
  (`src/lib/cost.ts`) pasaron una revisión por jury multi-agente (revisores independientes +
  voto) contra los quality gates del proyecto: determinismo, ausencia de dependencias nativas,
  legibilidad del costo MXN y correctitud de las restricciones duras. Los hallazgos menores
  (dead code, helper sin uso, semántica del mínimo operativo) se corrigieron antes del E2E.
- **UI**: login, dashboard con KPIs y botón de corrida, listado de tiendas, detalle con gráfica
  SVG demanda-vs-cobertura (selector de día), tabla de ahorro desglosado, rejillas de turnos
  (propuesta vs. línea base) y página de trazabilidad de restricciones.

Total aproximado de la sesión: scaffold + docs + solver + tests + auth + UI + verificación E2E
en una sola corrida, con cambios mínimos y conservadores sobre el scaffold.

## 2026-09-21 · Sesión 2 (capa de asistente IA opcional, decisiones D10)

- **Decisión**: asistente conversacional "Aurora" (LLM OpenAI-compatible + tool calls) con
  **Jev (TypeSafe System One) como tool gate**, siguiendo el patrón del proyecto
  `front-desk-assignment` del usuario (LLM con tool calls + harness de pruebas con fakeLlm).
  Endpoint de Jev confirmado contra docs/press: `POST https://api.typesafe.ai/v1/systemone`.
- **Implementación**: `src/server/chat/` (agent.ts bucle con MAX_ITERATIONS, tools.ts con 5
  herramientas sobre datos reales, llm.ts cliente OpenAI-compatible sin SDK, jev.ts gate con
  fallback), `POST /api/chat` (guard de sesión, sanitización de mensajes, 503 graceful sin
  `OPENAI_API_KEY`), `ChatPanel` flotante en el layout de la zona autenticada.
- **Tool gate**: lecturas siempre permitidas; `run_scheduler` (escritura) — Jev evalúa riesgo
  (noul). Riesgo > 50% exige `confirm=true` del usuario; ≤ 50% autoriza sin confirmación.
  Sin Jev (sin key o fallo de red): política conservadora, siempre exige confirmación.
- **Verificación**:
  - `tests/chat/agent.test.ts`: 7 tests con fakeLlm scriptado + fake db throwaway
    (mismo patrón que `harness/` de front-desk-assignment): respuesta con datos reales de
    herramientas, lecturas sin gate, gate aprueba/bloquea según probabilidad Jev, fallback
    sin Jev, límite de iteraciones. 18/18 tests totales del repo en verde.
  - E2E contra build de producción: sin `OPENAI_API_KEY` → 503 con mensaje claro
    (`AI_NOT_CONFIGURED`) y el resto de la app intacta; con key de prueba inválida → el error
    401 del LLM se propaga limpio (wiring verificado de punta a punta).
  - `tsc --noEmit`, `eslint` y `npm run build` en verde.
- **Docs**: decisión D10 y estructura actualizada en DECISIONES.md, sección de asistente en
  README, variables nuevas documentadas en .env.example.
- **Continuidad (agent-memory)**: al cerrar la sesión se persistieron el contrato del tool
  gate (umbrales, fallback), el estado del endpoint de Jev y los 7 escenarios de test del
  agente, para que la sesión siguiente retomara sin rederivar el diseño del gate.

## 2026-09-21 · Sesión 3 (QA: E2E con navegador real + usabilidad)

- **Continuidad (agent-memory)**: la sesión arrancó recuperando el estado del harness E2E, los
  guards conocidos (race de `router.refresh`, KPI por regex) y la lista de hallazgos de QA
  pendientes, en lugar de reexplorar el proyecto.
- **Harness E2E**: `scripts/e2e-user-test.mjs` (playwright-core como devDependency + Edge
  headless del sistema, sin descargas). Recorre la app como usuario real: redirect a login,
  login con credenciales demo, dashboard vacío, corrida desde el botón, segunda corrida
  (idempotencia: runs reemplazados, no duplicados), navegación por clicks, interacción con la
  gráfica, restricciones, chat (degradación graceful), logout + guard de rutas, login fallido
  con mensaje claro. Capturas en `scripts/e2e-shots/` (sirven como "capturas" del entregable 2).
- **Hallazgos y correcciones**:
  1. *Bug de datos*: la línea base sembraba turnos de 12h el sábado 12:00–24:00, fuera del
     horario de tienda (9–21). Corregido en `seed-data.ts` (turno largo 9:00–21:00). Mismo
     costo/ahorro ($38,062, 30.7%), solo realismo. Guard de regresión E2E: ningún turno
     "–24" visible.
  2. *Accesibilidad*: labels del login sin asociar al input (click en label no enfocaba;
     `getByLabel` fallaba). Corregido con `htmlFor`/`id`.
  3. *Usabilidad*: nav sin indicación de página activa (ahora `aria-current` + negrita vía
     `NavLink` cliente) y columna "%" renombrada a "% ahorro".
  4. *Robustez del harness propio*: race entre el mensaje de corrida y `router.refresh()`
     (ahora se espera el texto del KPI) y dependencia del estado previo (el script limpia
     corridas al inicio para ser idempotente).
  5. Hallazgo de entorno (no de la app): Better Auth rechaza 403 el sign-in si el Origin no
     coincide con `BETTER_AUTH_URL` — comportamiento correcto; documentado para el deploy.
- **Resultado final**: 27/27 checks E2E, 18/18 tests, `tsc`, `eslint` y `npm run build` en
  verde, 0 errores de página/consola. Confirmado visualmente por capturas que el flujo es
  comprensible sin instrucciones (CTA único en dashboard vacío, KPIs autoexplicativos).




## 2026-09-21 · Sesión 4 (de demo a producto vendible: diseño Aivena + funcionalidad)

- **Marca**: se extrajeron los tokens reales de aivena.ai (color ámbar `#F5A623`, fondos oscuros
  `#0A0A0C`–`#37373F`, IBM Plex Sans/Mono) y se construyó un design system «Aivena» sobre Tailwind 4:
  tema oscuro, tipografía Plex, primitivas de UI (`ui.tsx`), kit de gráficas SVG propio
  (`charts.tsx`: área, barras, dona), sidebar de navegación SaaS y topbar.
- **Funcionalidad nueva (ciclo operativo completo)**:
  - *Flujo de aprobación*: `ScheduleRun` ahora tiene estado `DRAFT → APPROVED → PUBLISHED` (+
    `ARCHIVED`), historial persistente, endpoints approve/publish y página «Programaciones».
  - *CRUDs reales*: alta de empleados (entran al solver), baja/reactivación inline; configuración
    operativa por tienda (service rate, mínimo en piso, horario) en Tiendas/Ajustes.
  - *Escenarios what-if*: simulador de ahorro al mover productividad/mínimo sin persistir.
  - *Demanda*: mapa de calor tráfico × día × hora + ventas históricas.
  - *Exportación CSV* de la programación publicada.
  - *Toasts* de confirmación en todas las acciones.
- **Páginas**: Panel, Programaciones, Tiendas (+detalle), Personal, Demanda, Escenarios,
  Cumplimiento (antes Restricciones), Ajustes. Sidebar con grupos Operación / Análisis /
  Administración.
- **Bugs RSC encontrados y corregidos en la sesión**:
  1. `format` como función de Server→Client Component (no serializable) → token `FormatToken`.
  2. `onChange` inline en `<Select>` de páginas de servidor → componente cliente `StoreSelector`.
  3. `acc` mutado durante el render en la dona → cálculo inmutable previo.
  4. `% exacto` del KPI en E2E dependía del nº de empleados → aserción por regex.
  5. Limpieza E2E ahora también resetea empleados de prueba y config de tiendas (determinismo).
- **Verificación**: 44/44 checks E2E (login, solver, aprobar→publicar→exportar CSV, CRUDs de
  personal, escenarios, demanda, ajustes, cumplimiento, chat, guards), 18/18 tests, tsc/eslint/
  build en verde, 0 errores de consola/página. Capturas revisadas visualmente.

## 2026-09-21 · Sesión 5 (QA post-producto: Dashlane, contraste chat, IA en vivo)

- **Hydration mismatch por extensión**: el usuario reportó error de hidratación en Escenarios.
  Causa: la extensión **Dashlane** inyecta atributos `data-dashlane-*` en formularios antes de que
  React hidrate (no es un bug de la app). Corrección: `suppressHydrationWarning` en los controles
  de formulario (Input/Select/Button en `ui.tsx`, login, store-selector, form de escenarios).
- **Contraste del chat**: el panel de chat usaba clases del tema claro legacy (texto claro sobre
  fondo claro). Reescrito con los tokens del design system oscuro; añadido render mínimo de
  markdown (**negrita**, *cursiva*) para las respuestas del LLM.
- **IA en vivo**: se configuró `OPENAI_API_KEY` en `.env` (gitignored). Se encontró y corrigió un
  bug real en el agente: los mensajes `tool` requieren un mensaje `assistant` previo con
  `tool_calls` (OpenAI lo exige) — se reconstruyó el transcript para incluirlo. Verificado: el
  asistente responde con datos reales ($38,062, 30.7%, desglose correcto). La key se manejó sin
  imprimirse y quedó fuera de git.
- **Verificación**: 44/44 E2E (ahora incluye el asistente configurado), 18/18 tests, tsc/eslint/
  build en verde, 0 errores de consola.

## Síntesis del método de trabajo

A lo largo de las 5 sesiones el patrón fue consistente:

1. **Planificación asistida**: decisiones de arquitectura no triviales (solver greedy vs. ILP,
   Prisma 6 vs. 7, Vercel vs. Railway) se exploraron primero con planning en consejo
   (Conclave) o en conversación con el modelo (Kimi Code), y solo después se tradujeron a
   implementación. Nada de código sin una decisión previa documentada (D1–D12).
2. **Implementación agéntica**: el agente principal (Kimi Code CLI) ejecutó el plan con
   subagentes para exploración paralela; la escritura de código a mano fue la excepción, no la
   norma.
3. **Revisión antes que merge**: los módulos críticos (solver, motor de costos, agente IA)
   pasaron revisión por jury multi-agente (Conclave) o revisión tipo code-review con rigor de
   junior engineer, con quality gates (lint, types, tests) siempre en verde.
4. **Verificación antes que implementación cuando la corrección es crítica**: los tests del
   solver (cap 40h, cobertura de picos, ≥8% de ahorro, determinismo) se escribieron y corrieron
   en cada iteración antes de dar una funcionalidad por cerrada; el harness E2E con navegador
   real (44 checks) se usó como gate final de cada sesión.
5. **Continuidad entre sesiones (agent-memory)**: decisiones, fuentes de restricciones y estado
   de verificación se persistieron entre sesiones, de modo que cada una retomó con contexto
   completo. Este documento es también producto de esa memoria.

Herramientas: Kimi Code CLI (agente principal), Conclave (orquestación multi-agente: council
planning + jury review), agent-memory (contexto persistente entre sesiones), playwright-core
(E2E con navegador real), Vitest (tests del solver).
