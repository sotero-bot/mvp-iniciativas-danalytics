---
id: change-001
req_id: REQ-012
title: Infraestructura i18n frontend + UI ES/PT + códigos de error backend
status: aprobado
created: 2026-06-10
supersedes: initial
---

# change-001 — Infraestructura i18n frontend + UI ES/PT + códigos de error backend

## Contexto

Primera fase del REQ-012. Entrega la infraestructura técnica de i18n y traduce toda la UI estática a ES/PT. El contenido del taller (preguntas, instrucciones, prompts) permanece en español; se traducirá en change-002 (modelo `Translation`) y change-004 (seed PT). Los prompts IA y la generación de PDF/Canvas se atacarán en change-003.

## ADDED

- Dependencias frontend: `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- Módulo `apps/web/src/i18n/` con configuración (`index.ts`) y carpetas `locales/es/` y `locales/pt/` con namespaces: `common`, `auth`, `admin`, `execution`, `methodology`, `organization`, `errors`.
- Componente `LanguageSwitcher` en `apps/web/src/components/LanguageSwitcher.tsx`, montado en el header global de `App.tsx` (visible para participante y admin).
- Detección automática del idioma del navegador al primer acceso (fallback `es` si no es `pt`).
- Persistencia del idioma elegido en `localStorage` (clave `i18nextLng`).
- Backend: `AppError` (`apps/api/src/shared/errors/AppError.ts`) — excepción con código semántico y detalles opcionales.
- Backend: `ErrorCodeFilter` (`apps/api/src/shared/errors/error-code.filter.ts`) — filtro NestJS global que serializa errores como `{ code, message, details? }`.
- Frontend: `fetchWithErrorMapping` (`apps/web/src/shared/api/fetchWithErrorMapping.ts`) — wrapper de `fetch` que mapea el `code` recibido del backend al texto traducido `t('errors:CODE')`.
- Tests: `tests/i18n/languageSwitcher.spec.ts` y `tests/errors/errorCodeFilter.spec.ts`.

## MODIFIED

- `apps/web/src/main.tsx` → inicializa `i18next` antes de renderizar `<App />`.
- `apps/web/src/App.tsx` → wrapper `<Suspense>` para carga de namespaces + `LanguageSwitcher` en sidebar/header.
- Todos los componentes React con strings literales en español → reemplazo por `t('namespace:key')`. Lista completa en sección "Archivos modificados" del manifest.
- `apps/api/src/main.ts` → registro de `ErrorCodeFilter` como filtro global.
- Backend NestJS: en los controllers y use-cases que lanzaban strings en español (`throw new BadRequestException('texto')`, `throw new NotFoundException('texto')`) → reemplazo por `throw new AppError('CODE', { detalles? })`.

## REMOVED

Nada en esta fase.

## Entidades de BD afectadas

Ninguna. El modelo `Translation` se introduce en change-002.

## Criterios de aceptación

1. El usuario ve un selector ES/PT en el header en cualquier pantalla del frontend; al cambiar el idioma, la UI cambia de inmediato sin recargar la página.
2. La elección de idioma persiste en `localStorage` (clave `i18nextLng`); al recargar la página, se mantiene.
3. En el primer acceso desde un navegador en portugués (`navigator.language` empieza por `pt`), la UI arranca en portugués; en cualquier otro caso, arranca en español.
4. La UI estática (botones, mensajes, validaciones, modales, toasts, navegación, formularios, headers) está disponible y consistente en español y portugués.
5. Cuando el backend devuelve un error, la respuesta tiene shape `{ code, message, details? }`; el frontend muestra el texto del `errors.json` del idioma activo (no el `message` crudo del backend).
6. El contenido del taller (preguntas, instrucciones, prompts) permanece en español (se traduce en changes posteriores).
7. Tests automáticos pasan (`npx vitest run`).
