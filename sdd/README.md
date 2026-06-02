# Metodología SDD — Índice maestro

> Punto de entrada de la metodología SDD para proyectos de IA con vibe coding.
> Equivalente modular de `requisitos.md` (monolítico, en la raíz del proyecto de metodología).

## Para agentes IA: cómo leer este sistema

Si eres un agente IA ejecutando una operación SDD:
1. **SIEMPRE** carga: este archivo + [`concepts/principles.md`](concepts/principles.md).
2. Luego carga ÚNICAMENTE los archivos listados en "Mapa de operaciones" abajo, según la operación.
3. **NO** cargues archivos no listados para tu operación.

## Propósito

Construir, evolucionar y mantener proyectos donde la implementación se hace con IA generativa (Claude Code, agentes, skills) sin perder control sobre requisitos, BD, frontend ni identidad. Permite absorber cambios de última hora a alta velocidad — como un MVP en evolución continua — sin destruir lo ya construido.

## Filosofía en 7 principios (resumen)

1. La especificación es la única fuente de verdad. El código es subproducto.
2. Actualizar el spec ANTES que el código.
3. Cambios atómicos versionados, nunca destructivos. Historia navegable.
4. Los errores son aprendizaje institucional. Causa raíz + prompt detonante + acción preventiva.
5. La IA propone, el humano decide. Dos checkpoints (papel → implementación).
6. Trazabilidad bidireccional: cada REQ sabe qué código implementa; cada ADR sabe qué REQ motiva.
7. Diferenciar cambio de requisito (versiona REQ) vs corrección de error (no versiona REQ).

Detalle completo: [`concepts/principles.md`](concepts/principles.md).

## Reglas duras (siempre activas)

1. `initial.md` jamás se modifica.
2. `change-*.md` solo se modifican para marcar superseded (frontmatter + banner ⚠️). Ver [`templates/change.md`](templates/change.md).
3. `INDEX.md` "Estado consolidado actual" es la única fuente de verdad del estado vigente. Ver [`templates/INDEX.md`](templates/INDEX.md).
4. `database/diagram.mmd` es autogenerado, no editar.
5. Cambio de requisito ≠ corrección de error. Ver [`concepts/error-management.md`](concepts/error-management.md).

## Mapa de la metodología

### Conceptos
- [Principios fundamentales](concepts/principles.md) — los 7 principios extendidos
- [Estructura del proyecto](concepts/structure.md) — árbol de carpetas + qué va en git
- [Convenciones](concepts/conventions.md) — IDs, estados, naming, idioma
- [Gestión de errores](concepts/error-management.md) — categorías, ciclo, multi-REQ
- [Validación de cambios](concepts/validation.md) — tests + checklist + smoke
- [Estrategia de carga de contexto](concepts/context-loading.md) — tiers, subagentes, compactación

### Workflows
- [`/init-project`](workflows/init-project.md) — bootstrap del proyecto
- [`/new-req`](workflows/new-req.md) — crear requisito desde cero
- [`/change-req`](workflows/change-req.md) — cambio con 3 agentes y 2 checkpoints
- [`/audit`](workflows/audit.md) — detectar drift entre código y spec
- [`/rollback`](workflows/rollback.md) — revertir un cambio
- [`/sync-schema`](workflows/sync-schema.md) — regenerar diagrama ER local
- [`/status`](workflows/status.md) — reporte de estado del proyecto
- [`/compact-req`](workflows/compact-req.md) — compactar changes históricos (opcional)
- [`/rebuild-index`](workflows/rebuild-index.md) — reconstruir INDEX desde changes (recuperación)
- [`/cleanup-branches`](workflows/cleanup-branches.md) — borrar ramas locales con PR mergeado (solo si hay git)
- [`/reverse-engineer`](../../.claude/commands/reverse-engineer.md) — documentar proyecto existente por ingeniería inversa (brownfield)

### Plantillas
- [`initial.md`](templates/initial.md) — primer estado de un REQ
- [`change-NNN.md`](templates/change.md) — Delta Spec ADDED/MODIFIED/REMOVED
- [`INDEX.md`](templates/INDEX.md) — estado consolidado actual del REQ
- [`manifest.md`](templates/manifest.md) — trazabilidad a código
- [`ERR-NNN.md`](templates/error.md) — registro de error
- [`ledger.md` por REQ](templates/ledger-req.md) — Refactor Ledger detallado
- [`ledger.md` global](templates/ledger-global.md) — resumen global del proyecto
- [ADR](templates/adr.md) — Architecture Decision Record (MADR + link a REQs)
- [`docs/vision.md`](templates/docs/vision.md), [`docs/tech-stack.md`](templates/docs/tech-stack.md), [`docs/personas.md`](templates/docs/personas.md), [`docs/constraints.md`](templates/docs/constraints.md)

### Referencia
- [Sistemas de migración por framework](reference/migrations-by-framework.md)
- [GitHub Actions: diagrama ER autogenerado](reference/github-actions.md)
- [Convenciones de naming y commits](reference/commit-conventions.md)
- [Roadmap de adopción incremental (brownfield)](reference/adoption-roadmap.md)

## Mapa de operaciones — qué cargar para cada operación

| Operación | Archivos a cargar (además de este README + principles.md) |
|---|---|
| `/init-project` | [`workflows/init-project.md`](workflows/init-project.md) + `templates/docs/*` + [`reference/migrations-by-framework.md`](reference/migrations-by-framework.md) |
| `/new-req` | [`workflows/new-req.md`](workflows/new-req.md) + [`templates/initial.md`](templates/initial.md) + [`templates/INDEX.md`](templates/INDEX.md) + [`concepts/conventions.md`](concepts/conventions.md) |
| `/change-req` (orquestador) | [`workflows/change-req.md`](workflows/change-req.md) + [`concepts/context-loading.md`](concepts/context-loading.md) |
| `/change-req` (planner) | [`workflows/change-req.md`](workflows/change-req.md) + [`concepts/context-loading.md`](concepts/context-loading.md) + [`templates/change.md`](templates/change.md) |
| `/change-req` (reviewer) | [`workflows/change-req.md`](workflows/change-req.md) (fase 2) |
| `/change-req` (implementer) | [`workflows/change-req.md`](workflows/change-req.md) (fase 3) + [`concepts/validation.md`](concepts/validation.md) + [`templates/manifest.md`](templates/manifest.md) + [`reference/migrations-by-framework.md`](reference/migrations-by-framework.md) |
| `/audit` | [`workflows/audit.md`](workflows/audit.md) + [`concepts/error-management.md`](concepts/error-management.md) |
| Error detectado | [`concepts/error-management.md`](concepts/error-management.md) + [`templates/error.md`](templates/error.md) |
| `/rollback` | [`workflows/rollback.md`](workflows/rollback.md) + [`reference/migrations-by-framework.md`](reference/migrations-by-framework.md) |
| `/sync-schema` | [`workflows/sync-schema.md`](workflows/sync-schema.md) + [`reference/github-actions.md`](reference/github-actions.md) |
| `/status` | [`workflows/status.md`](workflows/status.md) |
| `/compact-req` | [`workflows/compact-req.md`](workflows/compact-req.md) + [`concepts/context-loading.md`](concepts/context-loading.md) |
| `/rebuild-index` | [`workflows/rebuild-index.md`](workflows/rebuild-index.md) + [`templates/INDEX.md`](templates/INDEX.md) |
| `/cleanup-branches` | [`workflows/cleanup-branches.md`](workflows/cleanup-branches.md) + [`reference/commit-conventions.md`](reference/commit-conventions.md) |
| Crear ADR | [`templates/adr.md`](templates/adr.md) |
| Setup brownfield | [`reference/adoption-roadmap.md`](reference/adoption-roadmap.md) |
| `/reverse-engineer` | [`reference/adoption-roadmap.md`](reference/adoption-roadmap.md) + [`templates/initial.md`](templates/initial.md) + [`templates/INDEX.md`](templates/INDEX.md) + [`templates/manifest.md`](templates/manifest.md) + [`concepts/conventions.md`](concepts/conventions.md) |

## Versión

Este es el split modular del documento monolítico `requisitos.md`. Ambas versiones describen LA MISMA metodología — `requisitos.md` se mantiene como referencia para comparación durante la fase de validación.
