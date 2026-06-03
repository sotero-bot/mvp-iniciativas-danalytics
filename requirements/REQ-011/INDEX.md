---
req_id: REQ-011
title: Vista resumen y descarga del Canvas
status: implementado
current_state: change-002
---

# REQ-011 — Vista resumen y descarga del Canvas: Estado consolidado actual

## Descripción

Al finalizar el taller de Analytics Canvas, el participante accede a `/runner/:token/resultados`. Si la actividad es de tipo Analytics Canvas (detectado por `PlantillaActividad.nombre === 'Analytics Canvas'`), la página carga un canvas visual con los bloques B1–B10 en un layout grid (estilo Business Model Canvas). Cada bloque muestra una **síntesis generada por IA** (OpenAI) a partir de las respuestas del participante — no las respuestas en crudo. Un botón "Descargar Canvas" exporta un HTML autocontenido con las síntesis y prompts de IA contextualizados.

Para talleres de otro tipo, la página de resultados existente no se ve afectada.

## Estado de implementación

**Implementado.** change-002 aplicado el 2026-06-03.

## Funcionalidades

### Backend

- **`POST /execution/:token/canvas`** — endpoint en `ExecutionController`. Invoca `SintetizarCanvasPorTokenUseCase`. Si la actividad no es Analytics Canvas, devuelve 400. Si los bloques ya están en `CanvasBloque`, los devuelve sin llamar a OpenAI (caché lazy). En caso contrario, genera síntesis por bloque en paralelo y aplica upsert.
- **`SintetizarCanvasPorTokenUseCase`** — recupera respuestas de los pasos B1–B10, llama a OpenAI en paralelo (`process.env.OPENAI_MODEL || 'gpt-4o'`), aplica upsert en `CanvasBloque`, devuelve `Record<pasoId, resumen>`.
- **`GET /execution/:token` response** — incluye campo `esCanvas: boolean` calculado por nombre de plantilla.

### Frontend

- **`RunnerPage.tsx`** — al completar el último paso de un Analytics Canvas, dispara `fetch(POST /execution/:token/canvas)` sin `await` (fire & forget) inmediatamente después de `POST /finalizar`, para que OpenAI empiece a sintetizar mientras el participante ve la pantalla "¡Actividad completada!".
- **`RunnerResultsPage.tsx`** — detecta `esCanvas` en el payload. Si es true: llama `POST /canvas` (fallback/polling — el backend devuelve caché si ya generó), muestra `CanvasGrid` y botón "Descargar Canvas". Si es false: comportamiento previo inalterado.
- **`CanvasGrid.tsx`** — layout grid 3×4 con bloques B1–B10 y síntesis por bloque. Colores: Azul (B1 Problema, B2 Datos), Violeta (B3 KPIs, B4 Modelo analítico), Cyan (B5 Usuarios, B6 Equipo), Verde (B7 Entregables), Ámbar (B8 Riesgos), Naranja (B9 Potencial valor estratégico), Rojo (B10 Valor).
- **`buildCanvasHtml.ts`** — genera HTML standalone con: grid de síntesis, botones "Copiar prompt" por bloque, metadatos del taller (empresa, área, proyecto, fecha), autoguardado en `localStorage`, exportación a `.txt`, CSS `@media print`. Sin dependencias externas.

## Entidades de BD

### `CanvasBloque`

| Campo       | Tipo     | Notas                                   |
| ----------- | -------- | --------------------------------------- |
| id          | String   | UUID, PK                                |
| instanciaId | String   | FK → InstanciaActividad                 |
| pasoId      | String   | FK → PasoActividad                      |
| resumen     | Text     | Síntesis generada por OpenAI            |
| generadoEn  | DateTime | Timestamp de generación                 |
| updatedAt   | DateTime | @updatedAt                              |

Constraint: `@@unique([instanciaId, pasoId])` — un resumen por bloque por participante.
Índice: `@@index([instanciaId])`.

### Consumidas (solo lectura)

- `Respuesta` — fuente de las respuestas que se sintetizan.
- `InstanciaActividad` — metadatos de la instancia (empresa, actividad, fechas).
- `Actividad` — detectar tipo (por `PlantillaActividad.nombre`).
- `PasoActividad` — título y orden de cada bloque.
- `PlantillaActividad` — nombre para detectar tipo Canvas.

## Interfaz

**Backend:**
- `POST /execution/:token/canvas` → `{ bloques: Record<pasoId, resumen> }`
- `GET /execution/:token` → incluye `esCanvas: boolean`

**Frontend:**
- `RunnerPage.tsx` — dispara fire & forget de `/canvas` al finalizar último paso (si `esCanvas`)
- `RunnerResultsPage.tsx` — página de resultados con lógica condicional + fallback canvas
- `CanvasGrid.tsx` — componente de grid B1–B10
- `buildCanvasHtml.ts` — generador de HTML standalone

**DTOs:**
- `RunnerResponseDto` y interfaz local `RunnerData` — incluyen campo `esCanvas: boolean`

## Dependencias

- needs: [REQ-006, REQ-007, REQ-009]
- needed_by: []

## Decisiones de diseño

- **Síntesis por IA, no truncado:** el canvas muestra resúmenes de OpenAI, no respuestas en crudo.
- **Tabla `CanvasBloque` vs JSON en `InstanciaActividad`:** permite upserts concurrentes por bloque, mantiene `InstanciaActividad` liviana y facilita extensiones futuras.
- **Generación lazy con caché:** si los bloques existen en BD, se devuelven sin llamar a OpenAI. Regeneración explícita queda para iteración futura.
- **Fire & forget al finalizar:** la síntesis empieza mientras el participante ve la pantalla "completado"; cuando navega a resultados el canvas ya está listo o casi listo.
- **HTML standalone sin dependencias:** funciona offline, imprimible, sin CDN ni servidor.
- **Detección por nombre de plantilla:** `PlantillaActividad.nombre === 'Analytics Canvas'`. Sin campo `tipo` en schema — evita migración adicional y backfill.
- **`buildCanvasHtml.ts` separado:** no se modifica `buildResumenHtml.ts`. Aísla la lógica canvas y evita regresar sobre REQ-009.
- **Modelo OpenAI por env var:** `process.env.OPENAI_MODEL || 'gpt-4o'` en ambos use cases.

## Historial de cambios

| Change     | Descripción                                                       | Estado    |
| ---------- | ----------------------------------------------------------------- | --------- |
| initial    | Creación del REQ                                                  | histórico |
| change-001 | Implementación completa: endpoint, use case, schema, UI, HTML     | superseded |
| change-002 | Precalentar síntesis Canvas al finalizar actividad                | implementado |
