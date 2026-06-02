---
req_id: REQ-011
title: Vista resumen y descarga del Canvas
status: draft
current_state: design-refined
---

# REQ-011 — Vista resumen y descarga del Canvas: Estado consolidado actual

## Descripción

Al finalizar el taller de Analytics Canvas, el participante accede a `/runner/:token/resultados`. Si la actividad es de tipo Analytics Canvas, la página carga un canvas visual con los bloques B1–B10 en un layout grid (estilo Business Model Canvas). Cada bloque muestra una **síntesis generada por IA** (OpenAI) a partir de las respuestas largas del participante — no las respuestas en crudo. Un botón "Descargar Canvas" exporta un HTML autocontenido con las síntesis y los prompts de IA contextualizados listos para copiar en GPT-4o o Claude.

Para talleres de otro tipo, la página de resultados existente no se ve afectada.

## Estado de implementación

**Borrador — diseño refinado.** Pendiente de implementación.

## Funcionalidades previstas

- Detección del tipo de actividad: solo se activa si la actividad es de tipo Analytics Canvas.
- Al cargar resultados, el frontend llama a `POST /execution/:token/canvas` que sintetiza cada bloque con OpenAI y guarda en `CanvasBloque` (upsert). Si los bloques ya existen en BD, los devuelve sin regenerar.
- Síntesis por bloque: OpenAI recibe la respuesta larga del participante y genera un resumen de máximo 4 líneas adecuado para un canvas.
- Layout grid visual: 3 columnas × 4 filas, con colores por grupo temático:
  - Azul: B1 (Problema), B2 (Datos)
  - Violeta: B3 (KPIs), B4 (Modelo analítico)
  - Cyan: B5 (Usuarios), B6 (Equipo)
  - Verde: B7 (Entregables)
  - Ámbar: B8 (Riesgos)
  - Rojo: B10 (Valor)
- Botón "Descargar Canvas" en la página de resultados: genera y descarga un `.html` standalone autocontenido sin dependencias externas.
- HTML descargado incluye:
  - Layout grid con las síntesis de IA.
  - Por cada bloque con soporte IA: botón "Copiar prompt" que inyecta el contexto de las síntesis en el prompt y lo copia al portapapeles.
  - Metadatos del taller (empresa, área, proyecto, fecha).
  - Autoguardado en `localStorage` del navegador.
  - Exportación a `.txt`.
  - Compatible con impresión (CSS `@media print`).

## Entidades de BD

### Nueva — `CanvasBloque`

| Campo        | Tipo     | Notas                                      |
| ------------ | -------- | ------------------------------------------ |
| id           | String   | UUID, PK                                   |
| instanciaId  | String   | FK → InstanciaActividad                    |
| pasoId       | String   | FK → PasoActividad                         |
| resumen      | Text     | Síntesis generada por OpenAI               |
| generadoEn   | DateTime | Timestamp de generación                    |
| updatedAt    | DateTime | @updatedAt                                 |

Constraint: `@@unique([instanciaId, pasoId])` — un resumen por bloque por participante.
Índice: `@@index([instanciaId])` — fetch de los 9 bloques de una instancia en un index scan.

### Consumidas (solo lectura)

- `Respuesta` — fuente de las respuestas largas que se sintetizan.
- `InstanciaActividad` — metadatos de la instancia (empresa, actividad, fechas).
- `Actividad` — detectar si es tipo Analytics Canvas.
- `PasoActividad` — título y orden de cada bloque.

## Interfaz prevista

Backend:
- `POST /execution/:token/canvas` — genera (o devuelve cached) las síntesis de todos los bloques. Llama a OpenAI en paralelo (una llamada por bloque). Devuelve `{[pasoId]: resumen}`.

Frontend:
- `RunnerResultsPage.tsx` — detectar tipo canvas, llamar al endpoint, renderizar `CanvasGrid`.
- `CanvasGrid.tsx` — nuevo componente, layout grid B1–B10 con síntesis.
- `buildResumenHtml.ts` — extender para generar HTML canvas con síntesis y prompts embebidos.

## Dependencias

- needs: [REQ-006, REQ-007, REQ-009]
- needed_by: []

## Decisiones de diseño

- **Síntesis por IA, no truncado:** el canvas muestra resúmenes generados por OpenAI, no las respuestas en crudo. Evita que el canvas sea un documento largo con colores.
- **Tabla `CanvasBloque` en vez de JSON en `InstanciaActividad`:** permite upserts concurrentes por bloque, mantiene `InstanciaActividad` liviana, y facilita extender con `modeloIa`, `tokens_usados`, etc. sin migración adicional.
- **Generación lazy con caché:** si los bloques ya existen en `CanvasBloque`, el endpoint los devuelve sin volver a llamar a OpenAI. La regeneración explícita queda para una iteración futura.
- **HTML standalone sin dependencias:** el archivo descargado funciona offline, imprimible, sin CDN ni servidor.

## Historial de cambios

| Change         | Descripción                                                    | Estado  |
| -------------- | -------------------------------------------------------------- | ------- |
| initial        | Creación del REQ                                               | draft   |
| design-refined | Incorpora síntesis IA, tabla CanvasBloque y decisiones de diseño | draft |
