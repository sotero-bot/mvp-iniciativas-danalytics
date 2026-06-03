---
req_id: REQ-011
title: Vista resumen y descarga del Canvas
status: implementado
current_state: change-003
---

# REQ-011 — Vista resumen y descarga del Canvas: Estado consolidado actual

## Descripción

Al finalizar el taller de Analytics Canvas, el participante accede a `/runner/:token/resultados`. Si la actividad es de tipo Analytics Canvas, la página muestra un canvas visual con layout asimétrico (2 filas, bloques de altura variable) fiel al diseño de referencia. Cada bloque muestra ideas clave generadas por IA como sticky notes individuales. Un botón "Descargar Canvas" exporta un HTML standalone.

## Estado de implementación

**Implementado.** change-003 aplicado el 2026-06-03.

## Funcionalidades

### Backend

- **`POST /execution/:token/canvas`** — invoca `SintetizarCanvasPorTokenUseCase`. Si la actividad no es Analytics Canvas, devuelve 400. Caché lazy: si todos los bloques existen en `CanvasBloque`, los devuelve sin llamar a OpenAI.
- **`SintetizarCanvasPorTokenUseCase`** — para cada paso con respuesta, genera 2-4 ideas clave vía OpenAI (una por línea, sin viñetas, máx. 15 palabras). Si la respuesta está vacía o es `"(Sin respuesta registrada)"`, guarda string vacío sin llamar a OpenAI.
- **`GET /execution/:token`** — incluye `esCanvas: boolean`.

### Frontend

- **`CanvasGrid.tsx`** — layout `grid-template-areas` asimétrico:
  - Fila superior: Datos (tall) | Oportunidad / Indicadores | Problema (tall) | Usuarios / Entregables | Actores (tall)
  - Fila inferior: Restricciones (ancho) | Recursos requeridos (estático, vacío) | Potencial de valor
  - Bloques identificados por keyword en título del paso (no por orden numérico).
  - Síntesis renderizada como sticky notes individuales (una tarjeta por línea del resumen).
  - Bloques vacíos muestran área visual en color tenue (nunca skeleton ni ocultos).
- **`RunnerResultsPage.tsx`** — detecta `esCanvas`. Si true: llama `POST /canvas`, muestra `CanvasGrid` y botón "Descargar Canvas".
- **`buildCanvasHtml.ts`** — HTML standalone con grid de síntesis, botones "Copiar prompt", metadatos, `@media print`.

### Mapeo bloque taller → posición canvas

| Título contiene | Etiqueta canvas | Posición |
|---|---|---|
| "Problema" | Problema o reto actual | Centro, tall |
| "Solución" | Oportunidad | Top izq-centro |
| "Datos" | Datos y fuentes | Izquierda, tall |
| "Usuarios" | Usuarios | Top der-centro |
| "Entregables" | Entregables | Bottom der-centro |
| "Actores" | Actores principales | Derecha, tall |
| "KPI" / "Indicador" | Indicadores de éxito | Bottom izq-centro |
| "Barrera" / "Riesgo" | Restricciones | Bottom izquierda, ancho |
| "Valor" / "Potencial" | Potencial de valor | Bottom derecha |
| *(estático)* | Recursos requeridos | Bottom centro, siempre vacío |

## Entidades de BD

### `CanvasBloque`

| Campo       | Tipo     | Notas                        |
| ----------- | -------- | ---------------------------- |
| id          | String   | UUID, PK                     |
| instanciaId | String   | FK → InstanciaActividad      |
| pasoId      | String   | FK → PasoActividad           |
| resumen     | Text     | Ideas clave separadas por \n |
| generadoEn  | DateTime |                              |
| updatedAt   | DateTime | @updatedAt                   |

Constraint: `@@unique([instanciaId, pasoId])`. Índice: `@@index([instanciaId])`.

## Interfaz

- `POST /execution/:token/canvas` → `{ bloques: Record<pasoId, resumen> }`
- `GET /execution/:token` → incluye `esCanvas: boolean`
- Frontend: `CanvasGrid.tsx`, `RunnerResultsPage.tsx`, `buildCanvasHtml.ts`

## Dependencias

- needs: [REQ-006, REQ-007, REQ-009]
- needed_by: []

## Decisiones de diseño

- **Ideas clave por línea**: el prompt genera cada idea en una línea separada → el frontend divide por `\n` → una tarjeta sticky por idea.
- **Layout por keyword**: el mapeo usa búsqueda de substring en el título del paso para ser robusto ante renombrados menores.
- **Recursos requeridos estático**: no existe en el taller → siempre vacío, renderizado directamente en el componente sin pasoId.
- **Skip OpenAI para vacíos**: bloques sin respuesta se guardan como string vacío, sin coste de API.
- **Caché lazy**: segunda llamada al endpoint devuelve BD sin regenrar.

## Historial de cambios

| Change     | Descripción                                                   | Estado     |
| ---------- | ------------------------------------------------------------- | ---------- |
| initial    | Creación del REQ                                              | histórico  |
| change-001 | Implementación inicial: endpoint, use case, schema, UI, HTML  | superseded |
| change-003 | Rediseño visual: layout asimétrico, sticky notes, prompt      | implementado |
