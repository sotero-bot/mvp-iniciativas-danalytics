# mvp-iniciativas-danalytics

Proyecto desarrollado con **Spec-Driven Development (SDD)** para vibe coding con IA.

> La especificación es la única fuente de verdad. El código es subproducto.
> La IA propone, el humano decide.

## Por dónde empezar

- Si eres nuevo: lee `sdd/README.md` (índice maestro de la metodología).
- Si quieres hacer un cambio: tipea `/change-req` y describe en lenguaje natural.
- Si encontraste un bug: descríbelo — la skill `sdd-classify-issue` se activa.
- Si quieres ver el estado: pregunta *"¿cómo va el proyecto?"* — la skill `sdd-status` responde.

## Reglas duras (NO negociables)

1. **`requirements/**/initial.md` jamás se modifica.** Los cambios van como `change-NNN.md` nuevos.
2. **`change-*.md` existentes solo se modifican** para marcar `status: superseded`, añadir `superseded_by` en frontmatter y banner ⚠️ al inicio del cuerpo. El contenido ADDED/MODIFIED/REMOVED es inmutable.
3. **`INDEX.md` "Estado consolidado actual" es la única fuente de verdad** del estado vigente del REQ. Se reescribe íntegro en cada `/change-req`. Los agentes NUNCA reconstruyen el estado leyendo el historial.
4. **`database/diagram.mmd` es autogenerado.** NO editar a mano.
5. **Cambio de requisito ≠ corrección de error.** Cambio → versiona el REQ (`change-NNN.md`). Error → registra `ERR-NNN.md` en `errors/` del REQ, NO versiona el REQ (salvo que revele ambigüedad en el spec → entonces ambos).

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

Monorepo con dos apps bajo `apps/`:
- `apps/api` — NestJS 11 (Express) + TypeScript 5.9 + Prisma 5.22
- `apps/web` — React 19 + Vite 7 + React Router 7 + TipTap 3

Capas y dependencias clave:
- **Backend/API**: NestJS, Passport (local + JWT), `@nestjs/jwt`.
- **ORM**: Prisma 5.22 sobre PostgreSQL 17 (Supabase vía Vercel Postgres).
- **Storage**: AWS S3 SDK v3 (bucket `ia-gobernanza`) con presigned URLs.
- **IA**: OpenAI SDK 6.25 (modelo configurable por `OPENAI_MODEL` — actualmente `gpt-4o` hardcodeado en `ConsultarIaPorTokenUseCase`, ver REQ-007).
- **Entregables**: PDFKit 0.18, ExcelJS 4.4, Archiver 7, Mammoth 1.11, pdf-parse, marked 9.
- **Frontend**: TipTap (rich-text), UIW Markdown Editor, react-markdown + remark-gfm.
- **Hosting**: Vercel (vercel.json v2). Build: `prisma generate && prisma db push --accept-data-loss && tsc && vite build && npm run seed:admin`.
- **Dev local**: `npm run start:dev` (concurrently arranca `ts-node-dev` para la API y `vite` para el frontend en paralelo).

## Sistema de migraciones

`npx prisma db push` (NO `migrate dev`). El deploy en Vercel ejecuta automáticamente `prisma db push --accept-data-loss` en cada release.

- **NO uses migraciones destructivas sin respaldo previo de la BD** (drop de columna, alter de tipo).
- Las migraciones en `prisma/migrations/<YYYYMMDDHHMMSS_nombre>/migration.sql` son referencia histórica; `db push` sincroniza directamente desde `prisma/schema.prisma`, no las aplica una a una.
- Tras cambios al schema: `npx prisma generate` para regenerar el cliente.

## Errores conocidos a evitar (alucinaciones recurrentes)

{{lista que crece a partir de ERR-*.md categoría alucinacion_ia. Inicialmente vacía.}}

## Comandos disponibles

| Comando | Para qué |
|---|---|
| `/init-project` | Bootstrap del proyecto |
| `/new-req` | Crear requisito desde descripción natural |
| `/change-req` | Cambio con 3 agentes y 2 checkpoints (flujo crítico) |
| `/audit` | Detectar drift entre código y spec |
| `/rollback` | Revertir un change (operación destructiva) |
| `/sync-schema` | Regenerar diagrama ER local |
| `/compact-req` | Compactar changes históricos de un REQ |
| `/rebuild-index` | Recuperar INDEX de un REQ desde sus changes |
| `/cleanup-branches` | Borrar ramas locales con PR mergeado (solo si hay git) |
| `/reverse-engineer` | Documentar proyecto existente por ingeniería inversa |

## Skills (autodescubiertas)

| Skill | Cuándo se dispara |
|---|---|
| `sdd-status` | Preguntas sobre estado, progreso, qué falta |
| `sdd-classify-issue` | Reporte de bug, comportamiento raro |
| `sdd-guide` | Primera interacción en sesión, *"¿qué es esto?"* |

## Subagentes (los usan los comandos, no se invocan directo)

| Agente | Rol |
|---|---|
| `planner` | Fase 1 de `/change-req`: detecta impacto, propone Delta Specs |
| `reviewer` | Fase 2 de `/change-req`: revisión adversaria del plan |
| `implementer` | Fase 3 de `/change-req`: implementa código y tests |
| `auditor` | `/audit`: detecta drift y clasifica |

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
