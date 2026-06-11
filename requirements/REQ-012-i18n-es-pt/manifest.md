---
req_id: REQ-012
title: Internacionalización (i18n) — soporte ES/PT por sesión
last_synced: 2026-06-11
---

# Manifest — REQ-012

## Frontend — infraestructura i18n

- `apps/web/src/i18n/index.ts` — configuración de `i18next` con namespaces `common, auth, admin, execution, methodology, organization, errors`, detector de idioma (localStorage + navigator), fallback `es`, idiomas soportados `es | pt` (change-001).
- `apps/web/src/i18n/locales/es/{common,auth,admin,execution,methodology,organization,errors}.json` — traducciones en español (change-001).
- `apps/web/src/i18n/locales/pt/{common,auth,admin,execution,methodology,organization,errors}.json` — traducciones en portugués (change-001).
- `apps/web/src/components/LanguageSwitcher.tsx` — selector de idioma con variantes `sidebar` y `floating` (change-001).
- `apps/web/src/shared/api/fetchWithErrorMapping.ts` — wrapper de `fetch` que lanza `ApiError` con código + helper `translateError(err)` (change-001).
- `apps/web/src/main.tsx` — importa `./i18n` y envuelve `<App />` en `<Suspense>` para carga de namespaces (change-001).
- `apps/web/src/App.tsx` — monta `LanguageSwitcher` (variante sidebar dentro del Layout admin, variante floating en rutas `/runner/*`); reemplazo de strings literales por `t()` (change-001).

## Frontend — componentes refactorizados a `useTranslation`

- `apps/web/src/components/{ConfirmModal,WysiwygEditor,PromptTemplateField,Toast}.tsx` (change-001).
- `apps/web/src/features/auth/LoginPage.tsx` — login con selector embebido y errores traducidos vía `translateError` (change-001).
- `apps/web/src/features/admin/{DashboardPage,ImportPage}.tsx` (change-001).
- `apps/web/src/features/organization/{EmpresasPage,IniciativasPage}.tsx` (change-001).
- `apps/web/src/features/methodology/{PlantillasPage,PlantillaPasosPage,ActividadesPage,ActividadPasosPage}.tsx` (change-001).
- `apps/web/src/features/execution/{InstanciasPage,InstanciaDetallePage,RunnerPage,EnlaceRunnerPage,RunnerResultsPage,CanvasGrid}.tsx` (change-001).
- `apps/web/src/features/execution/{buildResumenHtml,buildCanvasHtml}.ts` — labels visibles del HTML descargable traducidos al idioma de sesión (change-001).

## Backend — sistema de errores con códigos

- `apps/api/src/shared/errors/AppError.ts` — excepción con código semántico (`AppErrorCode`), status HTTP por defecto coherente con cada código, y metadata opcional (change-001).
- `apps/api/src/shared/errors/error-code.filter.ts` — `ExceptionFilter` global que serializa `AppError`, `HttpException` y errores desconocidos al shape `{ code, message, statusCode, details? }` (change-001).
- `apps/api/src/main.ts` — registro de `ErrorCodeFilter` como filtro global (`app.useGlobalFilters`) (change-001).

## Backend — controllers y use-cases migrados a `AppError`

- `apps/api/src/modules/auth/infrastructure/local.strategy.ts` — `AUTH_INVALID_CREDENTIALS` (change-001).
- `apps/api/src/modules/organization/interfaces/empresas.controller.ts` — `ARCHIVO_REQUIRED`, `ARCHIVO_INVALID` (change-001).
- `apps/api/src/modules/organization/interfaces/admin-import.controller.ts` — `VALIDATION_ERROR`, `EMPRESA_NOT_FOUND` (change-001).
- `apps/api/src/modules/methodology/interfaces/admin-plantillas.controller.ts` — `PLANTILLA_NOT_FOUND`, `IMPORT_INVALID_JSON` (change-001).
- `apps/api/src/modules/methodology/interfaces/admin-plantilla-pasos.controller.ts` — `PLANTILLA_NOT_FOUND`, `PASO_NOT_FOUND`, `PREGUNTA_NOT_FOUND`, `S3_NOT_CONFIGURED`, `VALIDATION_ERROR` (change-001).
- `apps/api/src/modules/methodology/interfaces/admin-actividades.controller.ts` — `ACTIVIDAD_NOT_FOUND`, `PASO_NOT_FOUND`, `PREGUNTA_NOT_FOUND`, `S3_NOT_CONFIGURED`, `VALIDATION_ERROR`, `ARCHIVO_INVALID` (change-001).
- `apps/api/src/modules/methodology/application/InstanciarPlantillaUseCase.ts` — `PLANTILLA_NOT_FOUND`, `VALIDATION_ERROR` (change-001).
- `apps/api/src/modules/execution/interfaces/execution.controller.ts` — `INSTANCIA_NOT_FOUND`, `PASO_NOT_FOUND`, `ACTIVIDAD_NOT_FOUND`, `USUARIO_NOT_FOUND`, `S3_NOT_CONFIGURED`, `ARCHIVO_INVALID`, `VALIDATION_ERROR` (change-001).
- `apps/api/src/modules/execution/interfaces/admin-execution.controller.ts` — `INSTANCIA_NOT_FOUND`, `PASO_NOT_FOUND`, `ARCHIVO_INVALID`, `S3_NOT_CONFIGURED`, `EXCEL_GENERATION_FAILED` (change-001).
- `apps/api/src/modules/execution/application/SintetizarCanvasPorTokenUseCase.ts` — `INSTANCIA_NOT_FOUND`, `ACTIVIDAD_INVALID_TYPE` (change-001).

## Tests

- `tests/errors/errorCodeFilter.spec.ts` — 8 tests: `AppError` (status defaults, message custom, statusCode override, fallback) + `ErrorCodeFilter` (serialización de `AppError`, `HttpException` 404/400, errores desconocidos) (change-001).
- `tests/i18n/fetchWithErrorMapping.spec.ts` — 5 tests: response 200 passthrough, mapping de `{ code, message }` a `ApiError`, `NETWORK_ERROR` fallback, `translateError` ES/PT (change-001).

## Dependencias

- Dependencias frontend añadidas (`package.json`): `i18next`, `react-i18next`, `i18next-browser-languagedetector` (change-001).

## Backend — Translation

- `apps/api/src/modules/translation/translation.service.ts` — `TranslationService`: método `applyOverlay(entityType, ids, locale, fields)` con fallback a `es` (change-002).
- `apps/api/src/modules/translation/translation.module.ts` — `TranslationModule` que provee y exporta `TranslationService` (change-002).

## Base de datos

- `prisma/schema.prisma` — modelo `Translation` con índice único `(entityType, entityId, field, locale)` e índice de consulta `(entityType, entityId, locale)` (change-002).

## Notas

- El módulo de migraciones del proyecto sigue siendo `prisma db push`.
- `GET /execution/:token?locale=pt` aplica overlay de `TranslationService` sobre campos de texto de `PasoActividad` y `PreguntaActividad` (change-002).
- Los prompts a OpenAI y la generación del PDF/Canvas/Excel mantienen idioma por defecto (`es`) hasta change-003.
- Seed PT del contenido vigente queda para change-004.
