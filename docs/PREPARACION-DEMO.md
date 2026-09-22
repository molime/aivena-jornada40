# Preparación para la demo — JORNADA40 (45 min)

Guía de lectura rápida para llegar listo a la llamada. Estructura sugerida del tiempo:
**demo en vivo (~15 min) → decisiones técnicas/de producto (~15 min) → rol-play CFO/Dir. Ops (~15 min).**

---

## 1. Tu historia en 3 frases (dilas al inicio)

1. "Construí una herramienta que convierte el tráfico de clientes de una tienda en una
   programación semanal de personal que **cumple la reforma de 40 horas** y **cuantifica el
   ahorro en pesos**."
2. "El solver genera la propuesta, pero el producto la trata como lo haría una empresa real:
   un gerente la **aprueba** y la **publica** al equipo, con historial y exportación a CSV."
3. "Con datos operativos típicos de retail mexicano demuestra **~30% de ahorro laboral** (el
   objetivo era 8%) **sin subdotar las horas pico**, y deja trazabilidad de cada restricción legal."

Dato clave que debes saber de memoria: **ahorro ~30% (objetivo 8%) · 0 violaciones de
restricciones duras · 3 tiendas / 45 empleados en el demo (escala a 50×80).**

---

## 2. La demo en vivo (qué mostrar, en orden)

1. **Login** → `admin@demo.mx / demo1234`. (Di: "es Better Auth, open source, corre local.")
2. **Panel** → «Generar programación». Señala los KPIs: costo actual vs propuesto, ahorro $ y %.
3. **Programaciones** → Aprobar → Publicar → ⬇ CSV. (Di: "así cierra el ciclo en una empresa
   real: nadie publica turnos sin aprobación".)
4. **Tienda (detalle)** → gráfica demanda vs. cobertura (cambia a Sáb), tabla de ahorro
   desglosada, rejilla de turnos con la columna **Hrs/sem** (nadie pasa de 40).
5. **Escenarios** → mueve "clientes por empleado·h" de 12 a 10 y a 16. (Di: "esto es lo que le
   enseñaría a un CFO: la palanca y su efecto, sin comprometer nada".)
6. **Cumplimiento** → las 5 restricciones con fuente legal (LFT art. 61/69) en PASS.
7. *(Si hay tiempo)* **Asistente IA** → "¿cuánto ahorramos?". (Di: "capa opcional: un LLM que
   responde con datos reales vía tool calls; sin API key la app funciona igual".)

**Plan B:** si algo falla en vivo, tienes las capturas en `docs/screenshots/` (mismas pantallas).

---

## 3. Preguntas que te van a hacer (y respuestas)

### A. De producto

- **"¿Por qué una herramienta y no un Excel?"** — Excel no prueba cumplimiento ni optimiza
  contra demanda hora a hora. Aquí el solver garantiza el tope de 40h y la cobertura de picos
  como **restricciones duras** (no como promedio), y cuantifica el ahorro turno a turno.
- **"¿Quién la usaría en una empresa real?"** — El Director de Operaciones / gerente de tienda:
  genera la semana, aprueba y publica; el equipo recibe el CSV. El CFO usa Escenarios para la
  conversación de presupuesto.
- **"¿Qué pasa si un empleado falta?"** — Se regenera la semana en segundos (Personal → alta /
  baja → «Generar programación»). El solver reasigna con las mismas restricciones. *(Roadmap
  natural: turnos de refuerzo y disponibilidad por empleado.)*
- **"¿Cómo se conecta con mis sistemas?"** — Hoy el seed importa tráfico/ventas/plantilla a una
  base SQLite. En producción es un conector (el schema está listo para Postgres); el solver no
  cambia.

### B. Técnicas

- **"¿Cómo funciona el solver?"** — Tres fases: (1) tráfico por hora → dotación requerida
  (`⌈tráfico / clientes-por-empleado·h⌉`, con mínimo operativo); (2) generación de turnos de
  4/6/8h que cubren la curva de demanda por niveles; (3) asignación greedy a empleados
  respetando **≤40h/semana, ≥1 día de descanso, máx. 1 turno/día**. Es TypeScript puro,
  determinista y unit-testeado (18 tests).
- **"¿Por qué no OR-Tools / un solver de optimización?"** — Para 80 FTE × 50 tiendas un greedy
  con validación dura es suficiente, instantáneo, sin binarios nativos (reproducible en
  cualquier máquina) y —lo más importante— **explicable** ante un CFO. Un ILP sería una caja
  negra más lenta de defender. *(Si escala a miles de empleados con más restricciones, ahí sí
  se evalúa ILP — es un upgrade del módulo, no de la arquitectura.)*
- **"¿Cómo calculan el ahorro?"** — Costo semanal = horas × tarifa del rol; horas extra (>40h)
  ×1.5; prima dominical +25%. Ahorro = costo de la programación actual (línea base, sembrada
  con turnos planos y horas extra como en la práctica real pre-reforma) − costo propuesto.
  Desglose: horas extra evitadas + sobrestaffing evitado + prima dominical.
- **"¿Qué tan realistas son los datos?"** — 100% sintéticos y deterministas (seed fijo), con el
  **patrón operativo** real de una tienda departamental mexicana: picos al mediodía y por la
  tarde, sábado alto, domingo medio. Decisión deliberada: el reto pide datos sintéticos y así
  evitamos cualquier problema legal/ético con datos de marcas reales.
- **"¿Por qué SQLite y no Postgres?"** — El reto pide reproducibilidad "que corra sin ti":
  `npm install && npm run db:setup && npm run dev` y funciona. Cambiar a Postgres en producción
  es solo el provider de Prisma, sin tocar el schema.

### C. La reforma / negocio

- **"¿Qué cambia exactamente con la Jornada 40?"** — La LFT art. 61 reduce la jornada máxima de
  48h a **40h/semana**. El requisito operativo (cuánta gente y cuándo) no cambia, pero la
  capacidad legal disponible sí baja 17%. Quien hoy cumple con horas extra o 6 días, mañana no
  puede: tiene que **replanear con la misma gente**.
- **"¿El ahorro no es solo recortar horas?"** — No: la propuesta programa **más horas-productivas
  alineadas a la demanda** y elimina horas muertas (sobrestaffing en valle) y horas extra. Se
  cubren los picos igual o mejor — lo puedes mostrar en la gráfica verde ≥ gris.
- **"¿Y la prima dominical / descanso?"** — Ambos modelados (+25% domingo, ≥1 descanso
  semanal — LFT art. 69) y aparecen como restricciones trazables en Cumplimiento.
- **"¿Escala a 50 tiendas × 80 empleados?"** — Sí: `STORE_COUNT=50 EMPLOYEES_PER_STORE=80 npm run
  verify` lo demuestra en segundos (~35% de ahorro, 0 violaciones). El solver corre por tienda
  en paralelo conceptual; SQLite aguanta el volumen del demo y la forma de escalar es Postgres.

### D. Del asistente IA (si preguntan)

- **"¿Dónde usan IA?"** — Solo en la capa de **lenguaje** (el chat): un LLM responde preguntas
  del CFO llamando *herramientas* sobre datos reales (nunca inventa cifras). La parte crítica —
  asignar turnos — es 100% determinista.
- **"¿Y Jev qué es?"** — Un modelo clasificador (System One de TypeSafe) que hace de **tool
  gate**: evalúa si una llamada a herramienta es riesgosa antes de ejecutarla. Si marca riesgo,
  exige confirmación del usuario. Es el patrón "harness" que usan los agentes de código. Sin
  API key, el chat degrada con elegancia y el core funciona igual.

---

## 4. Preguntas incómodas y cómo navegarlas

| Si te preguntan… | No digas… | Di… |
|---|---|---|
| "¿Esto ya es producción?" | "Sí, está listo" | "Es una versión 0 sólida: el núcleo (solver + restricciones + ahorro) es real y verificado; faltan conectores a datos reales, multi-usuario con roles y manejo de ausencias — que es exactamente el siguiente tramo." |
| "¿Por qué 3 tiendas y no 50 en la demo?" | "Por tiempo" | "Por legibilidad en 45 minutos; el mismo seed genera 50×80 y el verify lo valida. Prefiero que veas el flujo completo bien a una tabla enorme." |
| "¿El 30% es creíble?" | "Sí, garantizado" | "Depende de qué tan mal planeen hoy. Asumí una línea base con sobrestaffing plano y horas extra, práctica común pre-reforma. La herramienta te deja ajustar el service rate y ver el rango — es honesta con sus supuestos (`docs/SUPUESTOS.md`)." |
| "¿Qué harías con 2 semanas más?" | — | "Conector a datos reales, roles (gerente vs. CFO), turnos de refuerzo para ausencias, y deploy multi-tienda." |

**Regla de oro del rol-play:** si el CFO pide un número que no tienes, ofrece el *mecanismo*:
"eso lo resolvemos ajustando X en Escenarios / Ajustes — míralo en vivo". Nunca inventes una cifra.

---

## 5. Qué NO hacer

- No defiendas la UI por la UI: todo diseño apunta a que un gerente entienda la pantalla sin manual.
- No vendas IA por vender IA: el argumento fuerte es "IA donde aporta (lenguaje), algoritmo
  donde manda el cumplimiento (turnos)".
- No ocultes los supuestos: la credibilidad ante un CFO viene de mostrar `docs/SUPUESTOS.md`.

---

## 6. Entregables del reto → dónde está cada uno

| Pide el reto | Está en |
|---|---|
| Herramienta funcionando | Repo + `npm run dev` (o el deploy) |
| Credenciales | `admin@demo.mx / demo1234` |
| Repositorio | github.com/molime/aivena-jornada40 |
| Documentación / decisiones | `README.md`, `docs/DECISIONES.md` (D1–D12) |
| Supuestos | `docs/SUPUESTOS.md` |
| Trazabilidad de restricciones | Página **Cumplimiento** + `ConstraintTrace` en DB |
| Registro de herramientas agénticas | `docs/USO-AGENTES.md` |
| Capturas | `docs/screenshots/` (11 PNG) |
EOF
echo "created"