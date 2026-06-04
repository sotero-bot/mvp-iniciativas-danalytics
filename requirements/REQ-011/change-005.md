---
id: change-005
req_id: REQ-011
title: Renombrar título "Analytics Canvas" → "Lienzo de oportunidad"
status: implementado
created: 2026-06-04
supersedes: change-004
---

# change-005 — Renombrar título "Analytics Canvas" → "Lienzo de oportunidad"

## Contexto

El título "Analytics Canvas" visible en la UI, el HTML descargable y el PDF se reemplaza por "Lienzo de oportunidad" para alinear el lenguaje con el cliente. Los identificadores internos de código (nombres de archivos, variables, lógica de detección de tipo `plantillaOrigen.nombre.includes('Analytics Canvas')`) permanecen sin cambio para no romper la BD ni la lógica de negocio.

## MODIFIED

- **Encabezado `<h2>` en `CanvasGrid.tsx`** — "Analytics Canvas" → "Lienzo de oportunidad"
- **`<title>` del HTML descargable en `buildCanvasHtml.ts`** — "Analytics Canvas — {proyecto}" → "Lienzo de oportunidad — {proyecto}"
- **Header sticky y header de impresión en `buildCanvasHtml.ts`** — mismo reemplazo
- **Footer del HTML descargable en `buildCanvasHtml.ts`** — "Generado por Analytics Canvas — Danalytics" → "Generado por Lienzo de oportunidad — Danalytics"
- **Título de página en `pdfDetalleGenerator.ts`** — "Analytics Canvas" → "Lienzo de oportunidad"
