---
req_id: REQ-008
title: Almacenamiento de archivos en S3
status: current
last_change: initial
---

# REQ-008 — Almacenamiento de archivos en S3: Estado consolidado actual

## Descripción

`S3Service`: capa reutilizable para subir, descargar, presignar y borrar objetos en el bucket `ia-gobernanza`. Define la convención de keys del proyecto (`<prefix>/<slug>-<uuid><ext>`).

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- `uploadFile`, `getPresignedPutUrl`, `getPresignedGetUrl` (con `Content-Disposition` opcional), `deleteObject`, `getObjectBuffer`.
- `generateKey(prefix, filename)` y `slugifyPathSegment(s)` para normalización uniforme.
- Modo degradado cuando faltan variables de entorno (`isConfigured: false`).

## Entidades de BD vigentes

Sin entidades propias. Consumido por: `PasoActividad`, `PasoPlantilla`, `PreguntaActividad`, `PreguntaPlantilla`, `Respuesta`.

## Interfaz vigente

Sin endpoints propios. Provider NestJS `S3Service` inyectado en controladores y use-cases que necesitan persistir o servir archivos.

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
