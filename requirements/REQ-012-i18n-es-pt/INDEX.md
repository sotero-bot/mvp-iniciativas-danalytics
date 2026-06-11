---
req_id: REQ-012
title: Internacionalización (i18n) — soporte ES/PT por sesión
status: aprobado
current_state: change-002
---

# REQ-012 — Internacionalización (i18n) — soporte ES/PT por sesión: Estado consolidado actual

## Descripción

Permitir al usuario seleccionar el idioma de la plataforma por sesión (español por defecto, portugués como segundo idioma soportado), con arquitectura escalable a múltiples idiomas. Cubre UI, contenido del taller almacenado en BD, respuestas generadas por IA y entregables descargados (PDF, Canvas HTML, Excel).

## Estado de implementación

**En implementación (parcial).** change-002 aprobado el 2026-06-11: modelo `Translation` + `TranslationService` + overlay en endpoints del taller. Quedan pendientes:
- change-003: prompts IA con locale dinámico + PDF/Canvas/Excel en idioma de sesión.
- change-004: seed PT del contenido vigente del taller.

## Funcionalidades vigentes (tras change-002)

- Selector de idioma ES/PT visible en el header de la plataforma; cambio inmediato sin recargar.
- Persistencia de la elección en `localStorage` (clave `i18nextLng`).
- Detección automática inicial del idioma del navegador (fallback `es` si no es `pt`).
- UI estática 100% traducida: botones, navegación, validaciones, modales, toasts, formularios, mensajes de error.
- Backend NestJS devuelve errores con shape `{ code, message, details? }`; frontend los mapea a texto traducido vía `errors.json`.
- Infraestructura `i18next` con namespaces por feature (`common`, `auth`, `admin`, `execution`, `methodology`, `organization`, `errors`).
- Tabla `Translation` en BD: overlay de contenido dinámico del taller por locale. Índice único `(entityType, entityId, field, locale)`.
- `TranslationService` NestJS: resuelve traducciones con fallback a `es` cuando no hay fila para el locale solicitado.
- `GET /execution/:token?locale=pt` devuelve pasos y preguntas con campos de texto traducidos al locale solicitado; si no hay traducción, devuelve el valor nativo en español.

## Funcionalidades pendientes

- Prompts a OpenAI con directiva dinámica de idioma (change-003).
- PDF final, Canvas HTML descargable y Excel en idioma de sesión (change-003).
- Seed inicial con traducciones PT del contenido vigente (change-004).

## Entidades de BD

- `Translation`: `id` (uuid), `entityType` (String), `entityId` (String), `field` (String), `locale` (String), `value` (Text), `createdAt`, `updatedAt`. Índice único `(entityType, entityId, field, locale)`. Índice de consulta `(entityType, entityId, locale)`.

## Historial de cambios

| Change     | Descripción                                                                         | Estado       |
| ---------- | ----------------------------------------------------------------------------------- | ------------ |
| initial    | Creación del REQ                                                                    | archived     |
| change-001 | Infraestructura i18n frontend + UI ES/PT + códigos de error backend                 | superseded   |
| change-002 | Modelo Translation + TranslationService + overlay en endpoints del taller           | aprobado     |
