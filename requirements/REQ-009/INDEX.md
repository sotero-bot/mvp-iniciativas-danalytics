---
req_id: REQ-009
title: Generación de entregables (PDF, Excel, ZIP)
status: current
last_change: initial
---

# REQ-009 — Generación de entregables (PDF, Excel, ZIP): Estado consolidado actual

## Descripción

Pipeline de generación de entregables a partir del contenido de una instancia: PDF resumen, Excel por paso (con cabeceras estilizadas), ZIP con PDF + archivos originales en S3 + Excels reconstruidos desde respuestas legacy. Incluye también la generación de Excel pre-rellenado con la salida de la IA para el taller "Mapa de Oportunidades".

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- PDF detalle con renderer de markdown sobre PDFKit.
- Excel por paso desde tabla markdown extraída de `contenidoArchivo`.
- ZIP con PDF + archivos S3 + Excels legacy reconstruidos.
- Presigned GET URL del archivo original de respuesta con nombre amigable.
- Excel pre-rellenado con respuesta IA del taller Mapa de Oportunidades.

## Entidades de BD vigentes

Sin entidades propias. Consume `InstanciaActividad`, `Interaccion`, `Respuesta`, `Actividad`, `Empresa`.

## Interfaz vigente

Backend:
- `GET /admin/instancias/:id/pdf`
- `GET /admin/instancias/:id/excel/:pasoId`
- `GET /admin/instancias/:id/zip`
- `GET /admin/instancias/:id/respuestas/:preguntaId/archivo-url`
- `POST /execution/:token/plantilla-prefilled/:pasoId`

Frontend:
- Botones de descarga en `InstanciasPage` y `InstanciaDetallePage`.
- Botón de plantilla pre-rellenada en `RunnerPage`.

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
