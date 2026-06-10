# {{nombre-del-proyecto}}

Proyecto desarrollado con **Spec-Driven Development (SDD)** para vibe coding con IA.

> La especificación es la única fuente de verdad. El código es subproducto.
> La IA propone, el humano decide.

## Por dónde empezar

- Si eres nuevo: lee `sdd/README.md` (índice maestro de la metodología).
- Si quieres hacer un cambio: tipea `/change-req` y describe en lenguaje natural.
- Si encontraste un bug: descríbelo — la skill `sdd-classify-issue` se activa.
- Si quieres ver el estado: pregunta _"¿cómo va el proyecto?"_ — la skill `sdd-status` responde.

## Reglas duras (NO negociables)

1. **`requirements/**/initial.md`jamás se modifica.** Los cambios van como`change-NNN.md` nuevos.
2. **`change-*.md` existentes solo se modifican** para marcar `status: superseded`, añadir `superseded_by` en frontmatter y banner ⚠️ al inicio del cuerpo. El contenido ADDED/MODIFIED/REMOVED es inmutable.
3. **`INDEX.md` "Estado consolidado actual" es la única fuente de verdad** del estado vigente del REQ. Se reescribe íntegro en cada `/change-req`. Los agentes NUNCA reconstruyen el estado leyendo el historial.
4. **`database/diagram.mmd` es autogenerado.** NO editar a mano.
5. **Cambio de requisito ≠ corrección de error.** Cambio → versiona el REQ (`change-NNN.md`). Error → registra `ERR-NNN.md` en `errors/` del REQ, NO versiona el REQ (salvo que revele ambigüedad en el spec → entonces ambos).
6. **Los bugs NO se guardan en memoria de Claude.** El registro de errores vive en `ERR-NNN.md` dentro del REQ afectado — no en el sistema de memoria personal del agente. La memoria es para preferencias del usuario y contexto de proyecto, no para bugs de código.

## Antes de tocar código

- Leer el `manifest.md` del REQ afectado para saber qué archivos implementan ese REQ.
- Si el cambio toca múltiples REQs, ejecutar `/change-req` (NO improvisar tocando código directo).
- Si el cambio es solo un fix de error, ir a la skill `sdd-classify-issue` antes de actuar.

## Flujo de git (si el proyecto está versionado)

- Todos los workflows que modifican archivos (`/new-req`, `/change-req`, `/rollback`) **crean una rama dedicada** antes de tocar nada:
  - `/new-req` → `req/<REQ-ID>-<slug>`
  - `/change-req` → `req/<REQ-ID>-change-<NNN>-<slug>` (o `-multi-` si afecta varios REQs)
  - `/rollback` → `rollback/<REQ-ID>-to-<target>`
- Los commits viajan en la rama. El usuario hace `git push` + abre PR cuando quiera.
- Tras mergear el PR, ejecutar `/cleanup-branches` para borrar la rama local.
- **Si el proyecto NO está versionado con git**, todo este flujo se SALTA automáticamente (los workflows detectan con `git rev-parse --git-dir`).
- Convenciones completas: `sdd/reference/commit-conventions.md`.

## Carga de contexto disciplinada

Los agentes leen información en **tiers**:

- **Tier 0** (siempre): `ledger.md` global + `docs/`.
- **Tier 1** (planner/auditor): `INDEX.md` de TODOS los REQs.
- **Tier 2** (bajo demanda): `manifest.md` de REQs impactados.
- **Tier 3** (solo recuperación): `change-NNN.md` históricos, `initial.md`.

Detalle en `sdd/concepts/context-loading.md`. **NUNCA cargues tier 3 en flujo normal.**

## Stack del proyecto

{{rellenar tras /init-project a partir de docs/tech-stack.md}}

## Sistema de migraciones

{{rellenar tras /init-project según docs/tech-stack.md y sdd/reference/migrations-by-framework.md}}

## Internacionalización (i18n)

El proyecto soporta múltiples idiomas vía `react-i18next` (frontend) + tabla `Translation` (BD, change-002 en adelante). REQ rector: **REQ-012**.

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

Eso solo basta para que el selector lo ofrezca y la UI estática quede traducida.

**Paso 3 — Contenido del taller en BD** (requiere change-002 ya implementado)

Insertar filas en la tabla `Translation` para cada `(entityType, entityId, field)` que deba aparecer en el nuevo idioma. Ejemplo:
```ts
await prisma.translation.createMany({
  data: [
    { entityType: 'PasoPlantilla', entityId: 'paso-1', field: 'titulo', locale: 'en', value: 'Identify your pain points' },
    // ...
  ],
});
```
No requiere migración ni cambios de código. Si falta una fila para un `locale`, `TranslationService` cae a `es` automáticamente.

**Paso 4 — Prompts IA y entregables** (requiere change-003 ya implementado)

Automático. Los prompts a OpenAI inyectan el `locale` de sesión y los generadores de PDF/Canvas HTML/Excel reciben el locale como parámetro. **No hay nada que hacer** salvo verificar que las traducciones de UI del Paso 1 estén completas.

### Reglas duras

- **NO uses strings literales en español** dentro de componentes nuevos — siempre `t('namespace:key')`.
- **Mantén paridad estricta entre locales**: si añades una clave en `es/foo.json`, añádela también en todos los otros locales con la traducción correspondiente. CI debería fallar si hay desbalance (TODO).
- **Errores del backend** siempre lanzan `AppError('CODE', { message?, details? })`, NUNCA `BadRequestException('texto en español')`. Si necesitas un código nuevo, agrégalo al type `AppErrorCode` en `AppError.ts` y a `errors.json` de TODOS los locales.
- **Contenido dinámico de BD** (preguntas, instrucciones, plantillas) NO se traduce con `t()` — se resuelve vía `TranslationService` que consulta la tabla `Translation`.
- **Prompts enviados al LLM** se mantienen en un idioma fijo por system prompt; el idioma de la respuesta se controla con una directiva (`Responde en {{locale}}`), no traduciendo el template del prompt.

## Errores conocidos a evitar (alucinaciones recurrentes)

{{lista que crece a partir de ERR-*.md categoría alucinacion_ia. Inicialmente vacía.}}

## Comandos disponibles

| Comando             | Para qué                                               |
| ------------------- | ------------------------------------------------------ |
| `/init-project`     | Bootstrap del proyecto                                 |
| `/new-req`          | Crear requisito desde descripción natural              |
| `/change-req`       | Cambio con 3 agentes y 2 checkpoints (flujo crítico)   |
| `/audit`            | Detectar drift entre código y spec                     |
| `/rollback`         | Revertir un change (operación destructiva)             |
| `/sync-schema`      | Regenerar diagrama ER local                            |
| `/compact-req`      | Compactar changes históricos de un REQ                 |
| `/rebuild-index`    | Recuperar INDEX de un REQ desde sus changes            |
| `/cleanup-branches` | Borrar ramas locales con PR mergeado (solo si hay git) |
| `/reverse-engineer` | Documentar proyecto existente por ingeniería inversa   |

## Skills (autodescubiertas)

| Skill                | Cuándo se dispara                                |
| -------------------- | ------------------------------------------------ |
| `sdd-status`         | Preguntas sobre estado, progreso, qué falta      |
| `sdd-classify-issue` | Reporte de bug, comportamiento raro              |
| `sdd-guide`          | Primera interacción en sesión, _"¿qué es esto?"_ |

## Subagentes (los usan los comandos, no se invocan directo)

| Agente        | Rol                                                           |
| ------------- | ------------------------------------------------------------- |
| `planner`     | Fase 1 de `/change-req`: detecta impacto, propone Delta Specs |
| `reviewer`    | Fase 2 de `/change-req`: revisión adversaria del plan         |
| `implementer` | Fase 3 de `/change-req`: implementa código y tests            |
| `auditor`     | `/audit`: detecta drift y clasifica                           |

## Modo de operación

El usuario da dirección en lenguaje natural. La IA:

- **Inferes** la intención al máximo posible. No interrogues.
- **Propones** plan completo antes de ejecutar.
- **Esperas aprobación** en los puntos de control definidos por cada workflow.
- **Ejecutas** sin pedir confirmaciones intermedias.
- **Reportas** de forma compacta y estructurada.

Cuando hay duda crítica (cambio destructivo, ambigüedad de scope), preguntas **una** pregunta clara. No abras interrogatorios.

## Detalle completo

Toda la metodología vive en `sdd/`. Empieza por `sdd/README.md` para el índice y el mapa de operaciones (qué archivo cargar para cada operación).
