# JORNADA40 — Optimización de workforce retail bajo la reforma de 40 horas

Producto funcional del reto técnico **AIVENA · JORNADA40** (Head de Producto y Tecnología), construido
como una aplicación que la propia AIvena podría vender: a partir de los datos operativos de un
retailer (tráfico de clientes, ventas históricas, plantilla y turnos), genera la **programación
semanal de personal** que

- **cumple el tope de 40 horas por empleado** (reforma Jornada 40 / LFT art. 61),
- **cuantifica en MXN el costo evitado** frente a la programación actual (horas extra y
  sobrestaffing), **sin subdotación en horas pico**, y
- **cierra el ciclo operativo**: generar → aprobar → publicar → exportar.

Retailer de demostración 100% sintético: **«Tienda Aurora»** (3 tiendas × 15 empleados; el modelo
soporta ~50 tiendas × ~80 FTEs). Resultado verificado: **~30% de ahorro** semanal con **0
violaciones de restricciones duras** (criterio del reto: ≥ 8%).

## Correr la herramienta

```bash
npm install
npm run db:setup     # crea SQLite + datos sintéticos + usuario demo (requiere .env; ver .env.example)
npm run dev          # http://localhost:3000
```

Credenciales demo: **admin@demo.mx / demo1234** · Producción local: `npm run build && npm start`.

> Si no existe `.env`, créalo desde `.env.example` y genera un `BETTER_AUTH_SECRET` aleatorio.

## Qué hace el producto

| Área | Funcionalidad |
|---|---|
| **Panel** | KPIs (costo actual/propuesto, ahorro MXN y %, cumplimiento), gráfica de costo, composición del ahorro, tabla por tienda con estado y cumplimiento. |
| **Programaciones** | Ciclo de vida real: el solver genera una **propuesta (Borrador)**, gerencia la **Aprueba**, se **Publica** al equipo (despublica la anterior) y se conserva el **historial**. |
| **Tiendas** | Tarjetas por tienda; detalle con demanda-vs-cobertura, ahorro desglosado, rejilla propuesta vs. línea base, y **configuración operativa** (horario, service rate, mínimo en piso). |
| **Personal** | Alta de empleados (entran al solver en la próxima corrida), **baja/reactivación** inline, costo base por plantilla. |
| **Demanda** | Mapa de calor de tráfico por tienda × día × hora, pico semanal, service rate y mínimo en piso, ventas históricas por día. |
| **Escenarios** | Simulador **what-if**: ajusta productividad / mínimo en piso y compara ahorro vs. configuración actual **sin guardar nada**. Herramienta de conversación con el CFO. |
| **Cumplimiento** | Trazabilidad de restricciones (40h, descanso semanal, cobertura de picos, sin horas extra) con fuente legal y evidencia; alertas si algo falla. |
| **Ajustes** | Palancas operativas por tienda que alimentan el solver. |
| **Exportación** | **CSV** de la programación publicada (para Excel / tablero de tienda). |
| **Asistente IA «Aurora»** | Chat (LLM + tool calls) sobre datos reales; `run_scheduler` protegido por un **tool gate con Jev**. Opcional — sin `OPENAI_API_KEY` la app funciona igual. |

## Verificación y tests

```bash
npm test             # 18 tests: 11 del solver + 7 del agente (fakeLlm, tool gate, fallback)
npm run verify       # corre el solver sobre el dataset sintético e imprime el ahorro (sin DB)
STORE_COUNT=50 EMPLOYEES_PER_STORE=80 npm run verify   # escala completa del enunciado (~35%)
npm run build && npm start   # en otra terminal, servidor en :3000, y luego:
npm run test:e2e     # 44 checks E2E con navegador real (playwright-core + Edge headless):
                     # login, solver, aprobar→publicar→exportar CSV, CRUDs, escenarios,
                     # ajustes, cumplimiento, chat; capturas en scripts/e2e-shots/
```

## Stack

Next.js 16 (App Router, TS) · Prisma 6 + SQLite · **Better Auth** · Tailwind 4 (design system
«Aivena»: tema oscuro, acento ámbar `#F5A623`, IBM Plex Sans/Mono) · Vitest · asistente opcional
con LLM OpenAI-compatible + **Jev** (TypeSafe System One) como tool gate.

Detalle y alternativas en [`docs/DECISIONES.md`](docs/DECISIONES.md);
supuestos del modelo en [`docs/SUPUESTOS.md`](docs/SUPUESTOS.md);
registro de uso de herramientas agénticas en [`docs/USO-AGENTES.md`](docs/USO-AGENTES.md).

## Estructura

```
prisma/               schema + seed (datos sintéticos deterministas, seed 4242)
scripts/verify.ts     verificación de ahorro sin base de datos
scripts/e2e-user-test.mjs   prueba E2E con navegador (playwright-core)
src/lib/solver/       núcleo puro: demanda -> turnos 4/6/8h -> asignación -> validación dura
src/lib/cost.ts       motor de costos MXN (tarifa/rol, h.extra 1.5x, prima dominical 25%)
src/server/           guard de sesión, orquestador del solver + flujo aprobar/publicar, chat
src/app/              Panel, Programaciones, Tiendas, Personal, Demanda, Escenarios,
                      Cumplimiento, Ajustes, API routes (auth, schedule, employees, stores,
                      export, chat)
src/components/       design system (ui, charts, sidebar, topbar, formularios, toasts, chat)
tests/                tests Vitest del solver y del agente
docs/                 decisiones, supuestos, registro agéntico
```

## Decisiones de datos

El reto pide datos definidos por el candidato: sintéticos, simulados sobre un retailer de referencia.
Decisión: datos 100% sintéticos generados por nosotros y retailer ficticio «Tienda Aurora» — sin usar
datos reales de ninguna marca. Documentado en `docs/DECISIONES.md §1.1`.
