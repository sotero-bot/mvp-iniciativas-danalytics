---
req_id: REQ-003
title: Plantillas metodológicas reutilizables
status: current
last_change: initial
---

# REQ-003 — Plantillas metodológicas reutilizables: Estado consolidado actual

## Descripción

Catálogo de plantillas de actividad (taller) parametrizables paso a paso y pregunta a pregunta. Cada plantilla puede ordenarse para constituir una secuencia de talleres. Las actividades concretas (REQ-004) se clonan desde plantillas.

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- CRUD de `PlantillaActividad`, `PasoPlantilla`, `PreguntaPlantilla`.
- Import masivo (`POST /admin/plantillas/import`) con bridge legacy paso→pregunta.
- Carga de prompts-template por pregunta a S3 mediante presigned PUT URL.
- Descarga de prompts-template mediante presigned GET URL.
- Carga de archivos de ejemplo por paso (vía `ejemploKey`).
- Soft delete en cascada.

## Entidades de BD vigentes

- `PlantillaActividad`
- `PasoPlantilla`
- `PreguntaPlantilla`

## Interfaz vigente

Backend (`/admin/plantillas/*`):
- CRUD de plantillas (`GET|POST|PUT|DELETE`).
- `POST /admin/plantillas/import`.
- CRUD de pasos por plantilla.
- CRUD de preguntas por paso.
- Endpoints de presign/prompt-template/URL por pregunta.

Frontend:
- `/admin/plantillas`
- `/admin/plantillas/:id/pasos`

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
