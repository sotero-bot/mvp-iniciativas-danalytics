---
id: change-002
req_id: REQ-012
title: Modelo Translation + TranslationService + overlay en endpoints del taller
status: implementado
created: 2026-06-11
supersedes: change-001
---

# change-002 — Modelo Translation + TranslationService + overlay en endpoints del taller

## Contexto

Segunda fase del REQ-012. Introduce la capa de persistencia de traducciones de contenido dinámico (pasos, preguntas) y la integra en el endpoint principal del participante. La UI estática ya está traducida (change-001); este change añade traducción del contenido del taller almacenado en BD. Los prompts IA y la generación de PDF/Canvas/Excel en idioma de sesión quedan para change-003. El seed PT del contenido vigente queda para change-004.

## ADDED

- Modelo Prisma `Translation`: campos `id` (uuid, PK), `entityType` (String), `entityId` (String), `field` (String), `locale` (String), `value` (Text), `createdAt`, `updatedAt`. Índice único `(entityType, entityId, field, locale)`. Índice de consulta `(entityType, entityId, locale)`.
- `apps/api/src/modules/translation/translation.service.ts` — `TranslationService` con método `applyOverlay(entityType, ids, locale, fields)`: si `locale === 'es'` retorna sin consultar BD (es el idioma nativo); caso contrario consulta `Translation` para el conjunto de ids+locale+fields y devuelve mapa `{ entityId → { field → value } }` para overlay.
- `apps/api/src/modules/translation/translation.module.ts` — `TranslationModule` que provee y exporta `TranslationService`.
- Migración Prisma: `prisma migrate dev` genera `CREATE TABLE "Translation"` con los índices.

## MODIFIED

- `prisma/schema.prisma` — añadir modelo `Translation`.
- `apps/api/src/modules/execution/interfaces/execution.controller.ts` — `GET /execution/:token` acepta query param `?locale=es|pt` (default `es`). Aplica overlay de `TranslationService` sobre los campos de texto de `PasoActividad` (`titulo`, `objetivo`, `instrucciones`, `promptIa`) y `PreguntaActividad` (`enunciado`, `promptIa`) antes de construir `RunnerResponseDto`.
- `apps/api/src/app.module.ts` — importa `TranslationModule`.
- `requirements/REQ-012-i18n-es-pt/manifest.md` — actualizado con nuevos archivos.

## REMOVED

Nada.

## Entidades de BD afectadas

- `Translation` (nueva tabla): overlay de solo lectura por los endpoints; los campos originales en las entidades del taller no se modifican.

## Criterios de aceptación

1. `GET /execution/:token?locale=pt` devuelve los campos de texto de pasos y preguntas con la traducción en portugués si existe fila en `Translation`; si no existe, devuelve el valor original en español (campo nativo del modelo). Sin error.
2. `GET /execution/:token` (sin `locale` o `?locale=es`) devuelve los campos en español sin consultar la tabla `Translation`.
3. La tabla `Translation` existe en BD con el índice único `(entityType, entityId, field, locale)` y el índice de consulta `(entityType, entityId, locale)`.
4. Tests automáticos pasan (`npx vitest run`).
