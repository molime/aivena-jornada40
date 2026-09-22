// E2E user testing con Playwright (chromium headless): recorre la app como un usuario real,
// ejercita el flujo completo del producto (solver → aprobación → publicación → export) y los
// CRUDs, toma capturas y falla ante errores de página/consola.
// Uso: node scripts/e2e-user-test.mjs  (servidor en $BASE_URL; Edge headless del sistema)
import { chromium } from "playwright-core";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = fileURLToPath(new URL("./e2e-shots/", import.meta.url));
fs.mkdirSync(SHOTS, { recursive: true });

// Estado inicial determinista: limpiar corridas previas y restablecer lo que el test muta
// (empleados de prueba, config de tiendas) — equivale a un estado fresco tras db:setup.
const require = createRequire(import.meta.url);
{
  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  await db.constraintTrace.deleteMany();
  await db.proposedShift.deleteMany();
  await db.scheduleRun.deleteMany();
  await db.employee.deleteMany({ where: { name: "Test E2E QA" } });
  await db.employee.updateMany({ data: { active: true } }); // reactivar cualquier baja residual de runs previos
  await db.store.updateMany({ data: { serviceRate: 12, minStaff: 2 } });
  await db.$disconnect();
}

const results = [];
let shotIdx = 0;
async function shot(page, name) {
  const file = `${String(++shotIdx).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: SHOTS + file, fullPage: false });
  results.push({ ok: true, label: `screenshot ${file}` });
}
function check(label, cond, detail = "") {
  results.push({ ok: !!cond, label, detail });
  if (!cond) console.error(`  ✖ ${label}${detail ? ` — ${detail}` : ""}`);
  else console.log(`  ✔ ${label}`);
}

const pageErrors = [];
const consoleErrors = [];

const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "msedge",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
const page = await ctx.newPage();
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  // 503 = chat sin OPENAI_API_KEY y 401 = login fallido del test negativo: resultados esperados.
  if (t.includes("503") || t.includes("401")) return;
  consoleErrors.push(t);
});

try {
  console.log("1) / redirige a /login");
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  check("redirect a /login", page.url().includes("/login"), page.url());
  await shot(page, "login");

  console.log("2) Login (credenciales demo visibles y funcionan)");
  check("hint de credenciales visible", await page.getByText("admin@demo.mx").first().isVisible());
  await page.getByLabel("Correo").fill("admin@demo.mx");
  await page.getByLabel("Contraseña").fill("demo1234");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard", { timeout: 10000 });
  check("aterrizaje en /dashboard", page.url().includes("/dashboard"));
  await page.waitForLoadState("networkidle");
  check("sidebar visible", await page.getByRole("complementary").isVisible().catch(() => false) || (await page.getByText("Programaciones").first().isVisible()));

  console.log("3) Dashboard vacío (estado inicial)");
  check("CTA de generación visible", await page.getByText("Generar programación").first().isVisible());
  await shot(page, "dashboard-empty");

  console.log("4) Generar programación (solver)");
  await page.getByRole("button", { name: /Generar programación/ }).click();
  await page.getByText(/Programación generada: 3\/3 tiendas válidas/).waitFor({ timeout: 30000 });
  check("toast de corrida OK", true);
  // el % exacto depende del nº de empleados activos; validamos que aparezca un % de ahorro
  await page.getByText(/\d+\.\d% del costo laboral/).waitFor({ timeout: 15000 });
  check("KPI ahorro visible", true);
  check("KPI cumplimiento visible", await page.getByText("0 violaciones").first().isVisible());
  await shot(page, "dashboard-with-runs");

  console.log("5) Programaciones: flujo aprobar → publicar → exportar CSV");
  await page.getByRole("link", { name: "Programaciones" }).click();
  await page.waitForURL("**/programacion");
  check("página de programaciones", await page.getByText("Borrador").first().isVisible());
  // aprobar la primera corrida DRAFT
  await page.getByRole("button", { name: "Aprobar" }).first().click();
  await page.getByText("Programación aprobada").waitFor({ timeout: 10000 });
  check("aprobación con toast", true);
  // publicar
  await page.getByRole("button", { name: "Publicar" }).first().click();
  await page.getByText("Programación publicada al equipo").waitFor({ timeout: 10000 });
  check("publicación con toast", true);
  await page.waitForTimeout(500);
  await shot(page, "programaciones-workflow");
  // export CSV de la corrida publicada: el link aparece tras publicar
  const csvHref = await page.locator('a[href*="api/schedule/export"]').first().getAttribute("href");
  check("link de exportación presente", !!csvHref, String(csvHref));
  if (csvHref) {
    const res = await page.request.get(BASE + csvHref);
    const body = await res.text();
    check("CSV descarga 200 y tiene filas", res.status() === 200 && body.split("\r\n").length > 5, `status=${res.status()} filas=${body.split("\r\n").length}`);
  }

  console.log("6) Tiendas → detalle (gráfica, rejillas, sin turnos fuera de horario)");
  await page.getByRole("link", { name: "Tiendas" }).click();
  await page.waitForURL("**/tiendas");
  check("grid de tiendas", await page.locator("a[href^='/tiendas/']").count() >= 3);
  await page.locator("a[href^='/tiendas/']").first().click();
  await page.waitForURL(/\/tiendas\/.+/);
  check("gráfica demanda vs cobertura", await page.getByText("Demanda vs. cobertura").isVisible());
  check("rejilla propuesta", await page.getByRole("heading", { name: "Programación propuesta" }).isVisible());
  check("rejilla línea base", await page.getByRole("heading", { name: "Programación actual (línea base)" }).isVisible());
  check("config operativa", await page.getByRole("heading", { name: "Configuración operativa" }).isVisible());
  const outOfHours = await page.locator("text=–24").count();
  check("ningún turno fuera del horario", outOfHours === 0, `encontrados=${outOfHours}`);
  await page.getByRole("button", { name: "Sáb", exact: true }).click();
  check("selector de día responde", true);
  await page.getByRole("heading", { name: "Programación actual (línea base)" }).scrollIntoViewIfNeeded();
  await shot(page, "store-detail");

  console.log("7) Personal: alta + baja de empleado");
  await page.getByRole("link", { name: "Personal", exact: true }).click();
  await page.waitForURL("**/personal");
  const before = await page.locator("tbody tr").count();
  await page.getByRole("button", { name: /Alta de empleado/ }).click();
  await page.getByPlaceholder("p.ej. Ana Martín").fill("Test E2E QA");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText(/dado de alta/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  const after = await page.locator("tbody tr").count();
  check("alta incrementa la tabla", after === before + 1, `${before} -> ${after}`);
  // dar de baja al recién creado: localizar su fila por nombre
  const qaRow = page.locator("tbody tr", { hasText: "Test E2E QA" });
  await qaRow.getByRole("button", { name: "Dar de baja" }).click();
  await page.getByText("Test E2E QA dado de baja").waitFor({ timeout: 10000 });
  check("baja con toast", true);
  check("fila marcada como Baja", await qaRow.getByText("Baja").isVisible());
  await shot(page, "personal");

  console.log("8) Escenarios (what-if) y Demanda");
  await page.getByRole("link", { name: "Escenarios", exact: true }).click();
  await page.waitForURL("**/escenarios");
  check("página de escenarios", await page.getByText("Palancas del escenario").isVisible());
  check("comparativa actual vs escenario", (await page.getByText("Escenario simulado").count()) >= 1);
  await shot(page, "escenarios");
  await page.getByRole("link", { name: "Demanda", exact: true }).click();
  await page.waitForURL("**/demanda");
  check("mapa de calor de demanda", await page.getByRole("heading", { name: /Tráfico de clientes/ }).isVisible());
  await shot(page, "demanda");

  console.log("9) Ajustes: editar config operativa de tienda");
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await page.waitForURL("**/ajustes");
  check("página de ajustes", await page.getByText("Palancas operativas").isVisible());
  const firstForm = page.locator("form").first();
  await firstForm.locator('input[name="serviceRate"]').fill("14");
  await firstForm.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Configuración de tienda guardada").waitFor({ timeout: 10000 });
  check("guardado de config con toast", true);
  // restaurar a 12 para no contaminar otros checks
  await firstForm.locator('input[name="serviceRate"]').fill("12");
  await firstForm.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Configuración de tienda guardada").waitFor({ timeout: 10000 });

  console.log("10) Cumplimiento (trazabilidad de restricciones)");
  await page.getByRole("link", { name: "Cumplimiento", exact: true }).click();
  await page.waitForURL("**/cumplimiento");
  check("traza 40h visible", await page.getByText("MAX_WEEKLY_HOURS").first().isVisible());
  check("badge PASS visible", await page.getByText("PASS").first().isVisible());
  check("estado global", await page.getByText("Todo en orden").isVisible());
  await shot(page, "cumplimiento");

  // 11) Asistente IA: detecta si hay OPENAI_API_KEY en .env y valida el comportamiento esperado
  const envText = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
  const aiConfigured = /^OPENAI_API_KEY=\s*"?\S+"/m.test(envText);
  console.log(`11) Asistente IA (configurado: ${aiConfigured ? "sí" : "no"})`);
  await page.getByRole("button", { name: "Asistente IA" }).click();
  await page.getByPlaceholder(/Pregunta sobre ahorro/).fill("¿cuánto ahorramos?");
  await page.getByRole("button", { name: "Enviar" }).click();
  if (aiConfigured) {
    // con key: esperar una burbuja de respuesta real (no el mensaje de "no configurado")
    try {
      await page.getByText(/pensando/).waitFor({ state: "visible", timeout: 3000 });
      await page.getByText(/pensando/).waitFor({ state: "hidden", timeout: 45000 });
    } catch {}
    await page.waitForTimeout(600);
    const degraded = await page.getByText(/Asistente IA no configurado/).count();
    check("asistente responde (no 'no configurado')", degraded === 0, `degraded=${degraded}`);
    await shot(page, "chat-live");
  } else {
    await page.getByText(/Asistente IA no configurado|Error/).waitFor({ timeout: 15000 });
    check("mensaje de degradación visible", await page.getByText(/Asistente IA no configurado/).isVisible());
    await shot(page, "chat-degraded");
  }

  console.log("12) Logout y guards de rutas");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click(); // cierra el panel flotante
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForURL("**/login", { timeout: 10000 });
  await page.goto(BASE + "/dashboard");
  check("protección de rutas tras logout", page.url().includes("/login"), page.url());

  console.log("13) Login con contraseña incorrecta");
  await page.getByLabel("Correo").fill("admin@demo.mx");
  await page.getByLabel("Contraseña").fill("mala");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByText("Credenciales inválidas").waitFor({ timeout: 10000 });
  check("error de credenciales visible", true);
} finally {
  await browser.close();
}

console.log("\n— Errores de página:", pageErrors.length ? pageErrors : "ninguno");
console.log("— Errores de consola:", consoleErrors.length ? consoleErrors : "ninguno");
if (pageErrors.length) results.push({ ok: false, label: "pageerrors", detail: pageErrors.join(" | ") });
if (consoleErrors.length) results.push({ ok: false, label: "console errors", detail: consoleErrors.join(" | ") });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks OK`);
if (failed.length) {
  console.error("FALLIDOS:", failed.map((f) => `${f.label}: ${f.detail}`).join("\n"));
  process.exit(1);
}
