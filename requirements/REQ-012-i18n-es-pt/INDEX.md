---
req_id: REQ-012
title: Internacionalización (i18n) — soporte ES/PT por sesión
status: draft
current_state: initial
---

# REQ-012 — Internacionalización (i18n) — soporte ES/PT por sesión: Estado consolidado actual

## Descripción

Permitir al usuario seleccionar el idioma de la plataforma por sesión (español por defecto, portugués como segundo idioma soportado), con arquitectura escalable a múltiples idiomas. Traduce UI, contenido del taller almacenado en BD, respuestas generadas por IA y PDF descargado.

## Estado de implementación

**Borrador.** Pendiente de aprobación e implementación vía `/change-req`.

## Funcionalidades previstas

- Selector de idioma en el header de la plataforma; persistencia en `localStorage`; detección automática inicial del idioma del navegador.
- UI 100% traducida (botones, navegación, validaciones, modales, toasts, formularios, errores).
- Contenido del taller traducido (pasos, preguntas, instrucciones, plantillas de prompts) a través de tabla `Translation`.
- Prompts a OpenAI con idioma dinámico inyectado, para que las respuestas IA salgan en el idioma del participante.
- Backend NestJS devuelve códigos de error semánticos; frontend los mapea a texto traducido.
- PDF final descargado en el idioma de sesión activo.
- Seed inicial con traducciones PT de todo el contenido vigente (Mapa de Oportunidades + Analytics Canvas + prompts).

## Entidades de BD

- `Translation(id, entityType, entityId, field, locale, value, createdAt, updatedAt)` con índice único `(entityType, entityId, field, locale)`.

## Historial de cambios

| Change  | Descripción      | Estado |
| ------- | ---------------- | ------ |
| initial | Creación del REQ | draft  |
