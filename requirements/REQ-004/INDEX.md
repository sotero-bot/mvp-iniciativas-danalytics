---
req_id: REQ-004
title: Configuración de actividades por iniciativa
status: current
last_change: initial
---

# REQ-004 — Configuración de actividades por iniciativa: Estado consolidado actual

## Descripción

Edición de actividades concretas (talleres) asociadas a una iniciativa. Cada actividad se compone de pasos y preguntas con todos los flags de IA, archivo y plantilla. Puede crearse vacía o clonarse desde una plantilla (REQ-003).

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- CRUD de `Actividad` con creación desde plantilla o vacía.
- CRUD de `PasoActividad` (con archivo de ejemplo en S3).
- CRUD de `PreguntaActividad` (con prompt-template en S3 y flags de IA/archivo).
- Soft delete en cascada (actividad → pasos → instancias).
- Listado anidado actividad → iniciativa → empresa.

## Entidades de BD vigentes

- `Actividad`
- `PasoActividad`
- `PreguntaActividad`

## Interfaz vigente

Backend:
- `/methodology/actividades[/:id]`
- `/admin/actividades/:id/pasos[/:pasoId][/preguntas[/:preguntaId]]`
- Endpoints `presign-ejemplo`, `ejemplo-url`, `presign-prompt`, `prompt-template`, `prompt-url`.

Frontend:
- `/admin/actividades`
- `/admin/actividades/:id/pasos`

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
