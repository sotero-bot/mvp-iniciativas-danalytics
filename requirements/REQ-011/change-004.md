---
id: change-004
req_id: REQ-011
title: Canvas en HTML descargable, PDF y vista admin
status: implementado
created: 2026-06-03
supersedes: change-003
---

# change-004 — Canvas en HTML descargable, PDF y vista admin

## Contexto

Con el rediseño visual (change-003) el canvas asimétrico sólo existía en `/runner/:token/resultados`. Este change extiende la misma visualización a tres superficies adicionales: el HTML standalone descargable, el PDF generado desde `admin/instancias`, y la página de detalle `admin/instancias/:id`.

## ADDED

- **`renderCanvasSection()` en `pdfDetalleGenerator.ts`** — dibuja el canvas en una página nueva del PDF usando pdfkit. Mismos 10 slots, mismas proporciones de columnas (1 1 1.4 1 1), mismos colores. Cada línea de resumen se renderiza como una sticky note (rect redondeado + texto). Bloques vacíos muestran área punteada. Se invoca automáticamente al final de `generatePdfBuffer()` si `instancia.canvasBloques.length > 0`.

## MODIFIED

- **`buildCanvasHtml.ts`** — reescrito para usar `grid-template-areas` asimétrico idéntico al de `CanvasGrid.tsx`. Sustituye el grid secuencial de 3 columnas anterior. Cada línea del resumen genera una `<div class="sticky-note">` individual. El script de exportación `.txt` y autoguardado localStorage se adaptan a la nueva estructura `.canvas-slot` / `.sticky-note`.
- **`GET /admin/instancias/:id`** — ahora incluye `canvasBloques: [{pasoId, resumen}]` en la respuesta. Cambios en tres archivos:
  - `PrismaInstanciaRepository.ts` — añade `canvasBloques: { select: { pasoId, resumen } }` al include de `findByIdWithRelations`.
  - `instancia-detalle-response.dto.ts` — añade campo `canvasBloques?: Array<{ pasoId: string; resumen: string }>`.
  - `ObtenerInstanciaDetalleUseCase.ts` — mapea `raw.canvasBloques` al DTO.
- **`InstanciaDetallePage.tsx`** — importa `CanvasGrid` y lo renderiza entre la tarjeta de información general y la sección de respuestas por paso, sólo cuando `canvasBloques.length > 0`.
- **`pdfDetalleGenerator.ts`** — `InstanciaDetalleData` añade campo `canvasBloques?` y `actividad.plantillaOrigen?`. `loadInstanciaForPdf` incluye `canvasBloques` y `plantillaOrigen` en el include de Prisma.

## Criterios de aceptación

- Descargar el HTML del canvas desde `/runner/:token/resultados` muestra el grid asimétrico (no el viejo grid de 3 columnas).
- Descargar el PDF desde `admin/instancias` incluye una última página "Analytics Canvas" con el grid coloreado y las sticky notes por bloque.
- Abrir `admin/instancias/:id` de una actividad Analytics Canvas muestra `CanvasGrid` entre los metadatos y las respuestas por paso.
- Para instancias de otros tipos de actividad (sin `canvasBloques`), ninguna de las tres superficies muestra sección canvas.
