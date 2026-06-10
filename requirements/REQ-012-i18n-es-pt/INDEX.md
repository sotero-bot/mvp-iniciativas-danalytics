---
req_id: REQ-012
title: Internacionalización (i18n) — soporte ES/PT por sesión
status: implementado
current_state: change-001
---

# REQ-012 — Internacionalización (i18n) — soporte ES/PT por sesión: Estado consolidado actual

## Descripción

Permitir al usuario seleccionar el idioma de la plataforma por sesión (español por defecto, portugués como segundo idioma soportado), con arquitectura escalable a múltiples idiomas. Cubre UI, contenido del taller almacenado en BD, respuestas generadas por IA y entregables descargados (PDF, Canvas HTML, Excel).

## Estado de implementación

**En implementación (parcial).** change-001 aprobado el 2026-06-10: infraestructura i18n frontend, UI 100% traducida ES/PT, códigos de error backend. Quedan pendientes:
- change-002: modelo `Translation` + servicio backend + integración con contenido del taller.
- change-003: prompts IA con locale dinámico + PDF/Canvas/Excel en idioma de sesión.
- change-004: seed PT del contenido vigente del taller.

## Funcionalidades vigentes (tras change-001)

- Selector de idioma ES/PT visible en el header de la plataforma; cambio inmediato sin recargar.
- Persistencia de la elección en `localStorage` (clave `i18nextLng`).
- Detección automática inicial del idioma del navegador (fallback `es` si no es `pt`).
- UI estática 100% traducida: botones, navegación, validaciones, modales, toasts, formularios, mensajes de error.
- Backend NestJS devuelve errores con shape `{ code, message, details? }`; frontend los mapea a texto traducido vía `errors.json`.
- Infraestructura `i18next` con namespaces por feature (`common`, `auth`, `admin`, `execution`, `methodology`, `organization`, `errors`).

## Funcionalidades pendientes

- Contenido del taller (preguntas, instrucciones, prompts, plantillas) traducido vía tabla `Translation` (change-002).
- Prompts a OpenAI con directiva dinámica de idioma (change-003).
- PDF final, Canvas HTML descargable y Excel en idioma de sesión (change-003).
- Seed inicial con traducciones PT del contenido vigente (change-004).

## Entidades de BD

Ninguna en change-001. `Translation` se introduce en change-002.

## Historial de cambios

| Change     | Descripción                                                              | Estado    |
| ---------- | ------------------------------------------------------------------------ | --------- |
| initial    | Creación del REQ                                                         | archived  |
| change-001 | Infraestructura i18n frontend + UI ES/PT + códigos de error backend      | implementado |
