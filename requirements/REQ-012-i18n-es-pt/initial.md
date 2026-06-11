---
id: REQ-012
title: Internacionalización (i18n) — soporte ES/PT por sesión
status: draft
created: 2026-06-10
---

# Internacionalización (i18n) — soporte ES/PT por sesión

## Descripción

Permitir al usuario seleccionar el idioma de la plataforma por sesión (por ahora español por defecto y portugués), con todos los textos visibles traducidos: UI, errores, contenido del taller (preguntas, instrucciones, prompts de IA), respuestas generadas por IA y PDF final descargado. La arquitectura debe ser escalable a múltiples idiomas adicionales sin requerir nuevos despliegues de código — agregar un idioma debe ser tan simple como añadir archivos de traducción de UI y filas en una tabla `Translation` para el contenido de BD.

## Criterios de aceptación

- El participante puede cambiar el idioma de su sesión desde un selector visible en el header; la elección persiste en `localStorage` y se aplica de inmediato sin recargar la página.
- Al primer acceso, el idioma se detecta automáticamente del navegador (`navigator.language`) con fallback a español si no es portugués.
- Toda la **UI estática** (botones, navegación, modales, validaciones, mensajes de error de UI, formularios, toasts) está disponible en español y portugués.
- El **contenido del taller** que vive en BD (títulos de pasos, preguntas, instrucciones, plantillas de prompts, mensajes de bienvenida) se traduce a través de la tabla `Translation` y se renderiza en el idioma de sesión.
- Los **prompts enviados a OpenAI** incluyen una directiva dinámica indicando el idioma de respuesta esperado, de modo que las respuestas de IA al participante salgan en su idioma de sesión.
- El **backend NestJS** devuelve códigos de error semánticos (ej. `AUTH_INVALID_CREDENTIALS`) en lugar de strings; el frontend mapea el código al texto traducido del idioma de sesión.
- El **PDF final descargado** se genera en el idioma de sesión activo en el momento de la descarga, incluyendo títulos, secciones y contenido del taller.
- Agregar un nuevo idioma (ej. inglés) requiere únicamente: (a) duplicar la carpeta de locale en el frontend y traducir los JSON, (b) insertar filas en `Translation` con el nuevo `locale`, (c) agregar el idioma a la lista de soportados — sin cambios estructurales de código.
- El seed inicial incluye traducciones en portugués para todo el contenido vigente del taller (Mapa de Oportunidades — 3 pasos; Analytics Canvas — 8 bloques; prompts IA configurados).

## Entidades de BD candidatas

- `Translation`: tabla normalizada para contenido traducible de BD.
  - Campos: `id`, `entityType` (ej. `PreguntaActividad`, `PasoActividad`, `CanvasBloque`, `PromptTemplate`), `entityId`, `field` (ej. `texto`, `instruccion`, `titulo`), `locale` (`es`, `pt`, ...), `value` (TEXT), `createdAt`, `updatedAt`.
  - Índice único: `(entityType, entityId, field, locale)`.
  - Índice de consulta: `(entityType, entityId, locale)`.

## Componentes UI candidatos

- `LanguageSwitcher` — selector de idioma en el header (visible en consola admin y en flujo del participante).
- `I18nProvider` — wrapper en `main.tsx` que inicializa `react-i18next` y carga namespaces por feature.
- Refactor transversal de componentes existentes para reemplazar strings hardcodeados por llamadas `t('namespace:key')`:
  - `apps/web/src/features/auth/` (login)
  - `apps/web/src/features/admin/` (consola del consultor)
  - `apps/web/src/features/execution/` (taller del participante)
  - `apps/web/src/features/methodology/`
  - `apps/web/src/features/organization/`
  - `apps/web/src/components/` (ConfirmModal, Toast, WysiwygEditor, PromptTemplateField)

## Dependencias

- needs: []
- needed_by: []

## Notas técnicas

- **Librerías frontend**: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- **Estructura de locales**: `apps/web/src/i18n/locales/<locale>/<namespace>.json` con un namespace por feature.
- **Backend**: nuevo servicio `TranslationService` (NestJS) que resuelve traducciones con fallback a `es` cuando no existe la versión solicitada. Helper de inyección de idioma en prompts de OpenAI.
- **PDF**: el generador (`PDFKit`) recibe `locale` como parámetro y obtiene los textos del taller vía `TranslationService` antes de renderizar.
- **Códigos de error**: convención `MODULE_REASON` (ej. `INSTANCIA_NOT_FOUND`, `AUTH_INVALID_CREDENTIALS`); el frontend mantiene un mapa `errorCodes.json` por locale.
- **Seed**: script Prisma que carga las traducciones PT del contenido vigente del taller en cada deploy (idempotente).
