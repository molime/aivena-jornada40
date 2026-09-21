# Registro de uso de herramientas agénticas (evidencia del proceso)

> Requisito del reto: "el registro de cómo usaste herramientas agénticas". Este documento se actualiza a
> lo largo del desarrollo.

## 2026-09-21 · Sesión 1 (Kimi Code CLI, agente principal + subagentes)

- **Extracción y análisis del PDF del reto** (`pdftotext`): detectado content stream corrupto con
  "Unknown operator" y texto ilegible tras la lista de retailers. Decisión documentada en
  `docs/DECISIONES.md §1.1`: se ignora el texto corrupto (posible prompt injection / trampa de
  descalificación), se usan únicamente datos sintéticos propios y retailer ficticio.
- **Diseño**: redacción de `docs/DECISIONES.md` (decisiones D1–D9, diseño de dominio, flujo, estructura
  de carpetas, etapas, prompt reutilizable) y `docs/SUPUESTOS.md`.
- **Scaffold**: `create-next-app` (Next.js 15, TS, Tailwind, App Router, src/) ejecutado en background.

## Sesión 1 · Continuación (implementación)

_(se actualiza al finalizar)_
