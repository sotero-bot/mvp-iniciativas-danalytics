---
id: REQ-011
last_synced: 2026-06-02
---

# Manifest — REQ-011

## Backend

- `apps/api/src/modules/execution/application/SintetizarCanvasPorTokenUseCase.ts` — dado un token, llama a OpenAI en paralelo por bloque y aplica upsert en CanvasBloque; caché lazy si todos los bloques ya existen (change-001)
- `apps/api/src/modules/execution/interfaces/execution.controller.ts` — endpoint `POST :token/canvas` que invoca SintetizarCanvasPorTokenUseCase; campo `esCanvas` añadido al DTO de `GET :token` (change-001)
- `apps/api/src/modules/execution/interfaces/dtos/index.ts` — campo `esCanvas: boolean` añadido a RunnerResponseDto (change-001)
- `apps/api/src/modules/execution/application/ConsultarIaPorTokenUseCase.ts` — corrección: modelo OpenAI ahora usa `process.env.OPENAI_MODEL || 'gpt-4o'` en vez de hardcoded (change-001)
- `apps/api/src/app.module.ts` — registro de SintetizarCanvasPorTokenUseCase como provider (change-001)

## Schema / Migración

- `prisma/schema.prisma` — modelo `CanvasBloque` (id, instanciaId, pasoId, resumen, generadoEn, updatedAt; relaciones inversas en InstanciaActividad y PasoActividad) (change-001)

> Nota: la migración se aplica con `npx prisma db push`. No hay archivo de migración SQL independiente porque el sistema de migraciones del proyecto es `prisma db push` (ver docs/tech-stack.md).

## Frontend

- `apps/web/src/features/execution/CanvasGrid.tsx` — componente grid 3×4 con bloques B1–B10 coloreados por grupo; muestra skeleton si el resumen aún no llega (change-001)
- `apps/web/src/features/execution/buildCanvasHtml.ts` — genera HTML standalone con metadatos del taller, botones "Copiar prompt", autoguardado en localStorage, exportación .txt y CSS @media print (change-001)
- `apps/web/src/features/execution/RunnerResultsPage.tsx` — detección de `esCanvas`; llama a `POST /execution/:token/canvas` al cargar, muestra CanvasGrid y botón "Descargar Canvas"; flujo previo inalterado para actividades no-Canvas (change-001)

## Tests

- `tests/execution/sintetizarCanvas.spec.ts` — 13 tests cubriendo: rechazo de actividades no-Canvas (400), caché lazy (no upsert cuando todos los bloques existen), token inválido (400), campo esCanvas en RunnerResponseDto, metadatos en HTML standalone, botones "Copiar prompt", script de autoguardado, función exportar .txt, CSS @media print, bloque B9 incluido, sin recursos externos, modelo OpenAI vía env var (change-001)

## Configuración de tests

- `vitest.config.mjs` — configuración de Vitest para el monorepo (change-001)
