---
id: REQ-011
title: Vista resumen y descarga del Canvas
status: draft
created: 2026-06-02
---

# Vista resumen y descarga del Canvas

## Descripción

Al finalizar el taller de Analytics Canvas, el participante puede ver todos los bloques (B1–B10) diligenciados en un layout visual tipo grid, similar al Business Model Canvas. Desde esa vista, un botón "Descargar Canvas" genera y descarga un archivo HTML autocontenido (sin dependencias externas) con el contenido completo, los prompts de IA listos para copiar, y soporte para edición, impresión y compartir.

## Criterios de aceptación

- Al llegar a `/runner/:token/resultados` en una instancia de tipo Analytics Canvas, se muestra el canvas completo con todos los bloques respondidos en el layout grid (3 columnas, 4 filas).
- Los bloques se colorean por grupo temático (entradas, análisis, personas, entregables, riesgos, valor).
- Un botón "Descargar Canvas" genera un archivo `.html` standalone autocontenido y lo descarga directamente en el navegador del usuario.
- El HTML descargado no requiere conexión a internet ni librerías externas para funcionar.
- El HTML descargado incluye, para cada bloque con soporte IA, un botón "Copiar prompt para IA" que inyecta el contexto de las respuestas del participante en el prompt y lo copia al portapapeles.
- El HTML descargado muestra los metadatos del taller (nombre del proyecto, empresa, área, fecha).
- Si el taller no es de tipo Analytics Canvas, la vista de resultados existente no se ve afectada.

## Entidades de BD candidatas

- `Respuesta`: consumida (lectura de respuestas por paso/pregunta de la instancia finalizada).
- `InstanciaActividad`: consumida (metadatos de la instancia: empresa, actividad, fechas).
- `Actividad`: consumida (nombre del taller, referencia a plantilla para detectar tipo canvas).
- `PasoActividad`: consumido (título y orden de cada bloque del canvas).

## Componentes UI candidatos

- `RunnerResultsPage.tsx` — modificar para renderizar `CanvasGrid` si la actividad es tipo canvas.
- `CanvasGrid.tsx` — nuevo componente que recibe los bloques con sus respuestas y los renderiza en el layout grid.
- `buildResumenHtml.ts` — extender para generar el HTML canvas autocontenido con prompts embebidos.

## Dependencias

- needs: [REQ-006, REQ-007, REQ-009]
- needed_by: []
