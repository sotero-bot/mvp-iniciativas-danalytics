---
id: change-001
req_id: REQ-011
title: Implementación completa — Vista resumen y descarga del Canvas
status: superseded
superseded_by: change-003
created: 2026-06-02
supersedes: design-refined
---

> ⚠️ **ESTADO HISTÓRICO.** Superseded by change-003. El estado vigente vive en `INDEX.md`. NO usar como fuente de verdad.

# change-001 — Implementación completa — Vista resumen y descarga del Canvas

## Contexto

El REQ-011 tenía el diseño completamente refinado (síntesis IA por bloque, tabla CanvasBloque, decisiones de arquitectura). Este change documenta la implementación completa: nuevo endpoint, use case, schema Prisma, componentes UI y generación de HTML canvas standalone. El REQ pasa de `draft/design-refined` a `implementado`.

## ADDED

### Backend

- **`SintetizarCanvasPorTokenUseCase.ts`** — dado un token de instancia, recupera las respuestas de los pasos B1–B10, llama a OpenAI en paralelo (una llamada por bloque) usando `process.env.OPENAI_MODEL || 'gpt-4o'`, aplica upsert en `CanvasBloque` y devuelve `Record<pasoId, resumen>`. Si todos los bloques ya existen en BD, los devuelve sin llamar a OpenAI (caché lazy).
- **`POST /execution/:token/canvas`** en `ExecutionController` — invoca `SintetizarCanvasPorTokenUseCase` y devuelve `{ bloques: Record<pasoId, resumen> }`. Devuelve 400 si la actividad no es Analytics Canvas.
- **Modelo Prisma `CanvasBloque`** — nueva tabla con: `id` (UUID PK), `instanciaId` (FK InstanciaActividad), `pasoId` (FK PasoActividad), `resumen` (Text), `generadoEn` (DateTime), `updatedAt` (DateTime @updatedAt). Constraint `@@unique([instanciaId, pasoId])`. Índice `@@index([instanciaId])`.

### Frontend

- **`CanvasGrid.tsx`** — nuevo componente, layout grid 3×4 que renderiza bloques B1–B10 con sus síntesis. Colores por grupo temático:
  - Azul: B1 (Problema), B2 (Datos)
  - Violeta: B3 (KPIs), B4 (Modelo analítico)
  - Cyan: B5 (Usuarios), B6 (Equipo)
  - Verde: B7 (Entregables)
  - Ámbar: B8 (Riesgos)
  - Naranja: B9 (Potencial valor estratégico)
  - Rojo: B10 (Valor)
- **`buildCanvasHtml.ts`** — función separada (no extiende `buildResumenHtml.ts`). Genera HTML standalone con layout grid de síntesis + botones "Copiar prompt" por bloque, metadatos del taller (empresa, área, proyecto, fecha), autoguardado en `localStorage`, exportación a `.txt`, CSS `@media print`. Sin dependencias externas.

## MODIFIED

- **`RunnerResultsPage.tsx`** — añade detección de tipo Canvas vía campo `esCanvas` en el payload de `GET /execution/:token`. Renderizado condicional: si `esCanvas`, muestra `CanvasGrid` y botón "Descargar Canvas" (llama a `buildCanvasHtml`); si no, comportamiento previo inalterado.
- **`GET /execution/:token` response** — añade campo `esCanvas: boolean` calculado por nombre de plantilla (`PlantillaActividad.nombre === 'Analytics Canvas'`).
- **`RunnerResponseDto` y interfaz `RunnerData`** (frontend) — añade campo `esCanvas: boolean`.
- **`ConsultarIaPorTokenUseCase.ts`** — corrección de deuda técnica: modelo OpenAI hardcodeado `'gpt-4o'` reemplazado por `process.env.OPENAI_MODEL || 'gpt-4o'`.

## REMOVED

Ninguno.

## Entidades de BD afectadas

- Nueva tabla `CanvasBloque` (migración aditiva, no destructiva).
- Relaciones inversas añadidas en `InstanciaActividad` y `PasoActividad` del schema Prisma.
- Aplicar con `npx prisma db push`.

## Criterios de aceptación

- Al cargar `/runner/:token/resultados` con un token de actividad Analytics Canvas, la página llama a `POST /execution/:token/canvas` y muestra `CanvasGrid` con las síntesis generadas.
- Si se recarga la página, los bloques se sirven desde `CanvasBloque` en BD sin llamar a OpenAI de nuevo.
- Para talleres de cualquier otro tipo, la página de resultados existente se renderiza sin cambios (sin llamar al endpoint canvas).
- El botón "Descargar Canvas" genera un `.html` standalone que funciona offline, muestra el grid con síntesis B1–B10 (incluyendo B9 "Potencial valor estratégico") y los botones "Copiar prompt" funcionan sin servidor.
- Cada bloque del HTML descargado incluye los metadatos del taller (empresa, área, proyecto, fecha).
- `npx prisma db push` aplica el modelo `CanvasBloque` sin pérdida de datos.
