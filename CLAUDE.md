# MVP Iniciativas Danalytics

## Stack

- **Frontend**: React + Vite + TypeScript, `react-i18next` para i18n
- **Backend**: NestJS + Prisma + PostgreSQL
- **Storage**: S3 (AWS) para archivos y templates
- **IA**: OpenAI (modelo configurable via `OPENAI_MODEL`)
- **Deploy**: Vercel (frontend) + backend independiente

## Modo de operación

- Infiere la intención al máximo. No interrogues.
- Cuando haya duda crítica (cambio destructivo, ambigüedad de scope), haz **una** pregunta clara.
- No commitear sin que el usuario lo pida explícitamente.

## Internacionalización (i18n)

El proyecto soporta `es` y `pt`. REQ rector: change-002 / change-003.

### Arquitectura

- **Frontend**: `apps/web/src/i18n/index.ts` configura `i18next` con detección automática (`navigator.language`), persistencia en `localStorage` (clave `i18nextLng`) y fallback a `es`.
- **Locales**: `apps/web/src/i18n/locales/<lng>/<namespace>.json`. Namespaces: `common`, `auth`, `admin`, `execution`, `methodology`, `organization`, `errors`.
- **Selector**: componente `LanguageSwitcher` (variantes `sidebar` y `floating`) montado en `App.tsx`.
- **Errores backend**: `apps/api/src/shared/errors/AppError.ts` lanza códigos semánticos (`AUTH_INVALID_CREDENTIALS`, `INSTANCIA_NOT_FOUND`, etc.). `ErrorCodeFilter` los serializa como `{ code, message, statusCode }`. El frontend mapea cada `code` a `t('errors:CODE')` vía `apps/web/src/shared/api/fetchWithErrorMapping.ts`.

### Para añadir un nuevo idioma (ej. inglés `en`)

**Paso 1 — Crear carpeta de locale**
```bash
cp -r apps/web/src/i18n/locales/es apps/web/src/i18n/locales/en
```
Traducir el contenido de los 7 archivos JSON en `locales/en/`.

**Paso 2 — Registrar el idioma en `apps/web/src/i18n/index.ts`**
- Importar los nuevos JSON (`import enCommon from './locales/en/common.json'`, etc.).
- Añadir `'en'` al array `SUPPORTED_LANGUAGES`.
- Añadir su etiqueta legible al objeto `LANGUAGE_LABELS` (ej. `en: 'English'`).
- Añadir un bloque `en: { common: enCommon, auth: enAuth, ... }` al objeto `resources`.

**Paso 3 — Contenido del taller en BD**

Insertar filas en la tabla `Translation` para cada `(entityType, entityId, field)`. Si falta una fila para un `locale`, `TranslationService` cae a `es` automáticamente.

**Paso 4 — Prompts IA y entregables**

Automático. Los prompts inyectan el `locale` de sesión. No hay nada que hacer salvo verificar las traducciones de UI del Paso 1.

### Reglas duras

- **NO uses strings literales en español** dentro de componentes nuevos — siempre `t('namespace:key')`.
- **Mantén paridad estricta entre locales**: si añades una clave en `es/foo.json`, añádela también en todos los otros locales.
- **Errores del backend** siempre lanzan `AppError('CODE', ...)`, NUNCA `BadRequestException('texto en español')`. Si necesitas un código nuevo, agrégalo al type `AppErrorCode` en `AppError.ts` y a `errors.json` de TODOS los locales.
- **Contenido dinámico de BD** (preguntas, instrucciones, plantillas) NO se traduce con `t()` — se resuelve vía `TranslationService`.
- **Prompts enviados al LLM** se mantienen en un idioma fijo; el idioma de la respuesta se controla con una directiva (`Responde en {{locale}}`).
