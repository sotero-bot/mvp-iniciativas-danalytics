# Convenciones de naming y commits

> Convenciones de nombres de branches, formato de commits y por qué importan para [`/audit`](../workflows/audit.md).

## Branches

| Patrón | Cuándo usar | Quién la crea |
|---|---|---|
| `req/<REQ-ID>-<slug>` | Creación de un REQ nuevo. Ej: `req/REQ-AUTH-001-login-google` | [`/new-req`](../workflows/new-req.md) |
| `req/<REQ-ID>-change-<NNN>-<slug>` | Cambio sobre un REQ existente. Ej: `req/REQ-AUTH-001-change-002-session-30min` | [`/change-req`](../workflows/change-req.md) — single REQ |
| `req/<PRIMARY-REQ-ID>-change-<NNN>-multi-<slug>` | Cambio que afecta a varios REQs. Ej: `req/REQ-AUTH-001-change-002-multi-session-policy` | [`/change-req`](../workflows/change-req.md) — multi REQ |
| `err/<ERR-ID>-<slug>` | Fix de un error documentado. Ej: `err/ERR-001-loop-redirect` | Manual (tras `sdd-classify-issue`) |
| `rollback/<REQ-ID>-to-<target>` | Reversión de un change. Ej: `rollback/REQ-AUTH-001-to-change-001` | [`/rollback`](../workflows/rollback.md) |
| `chore/<slug>` | Tareas de mantenimiento (CI, diagramas, deps). Ej: `chore/sync-schema` | Manual |

El slug del REQ o ERR en el nombre de branch facilita correlacionar branch ↔ spec. El slug descriptivo corto (3-5 palabras, kebab-case) facilita identificar el cambio sin abrir el PR.

## Lifecycle de una branch

1. **Creación** — La crea el workflow correspondiente al detectar git en el proyecto. Si el proyecto NO está versionado con git, se salta este paso.
2. **Commits** — Los workflows commitean en la rama siguiendo las convenciones de commit (sección siguiente). Para `/change-req`, son dos commits por flujo: uno tras checkpoint 1 (papel, `docs:`) y otro tras checkpoint 2 (código, `feat:` o `fix:`).
3. **Push y PR** — El usuario hace `git push -u origin <branch>` y abre PR en GitHub/GitLab. (No es responsabilidad de los workflows — es decisión del usuario cuándo subir.)
4. **Review y merge** — En la plataforma. Cuando el PR se aprueba y mergea, los cambios entran a `main`.
5. **Limpieza local** — Tras mergear, ejecutar [`/cleanup-branches`](../workflows/cleanup-branches.md) para borrar la rama local. La rama remota la limpia GitHub/GitLab automáticamente si está configurado (o por housekeeping).

## Si el proyecto NO está versionado con git

- Saltar todo el flujo de ramas. Las modificaciones se aplican directamente al filesystem.
- Los comandos detectan automáticamente (`git rev-parse --git-dir`) y omiten la sección de git si no hay repo.
- No se hacen commits. El usuario decide cuándo (y si) versionar el proyecto.

## Commits

Cuando el flujo de PR se active (no obligatorio al inicio), seguir esta convención:

| Prefijo | Cuándo usar | Ejemplo |
|---|---|---|
| `feat(REQ-XXX-NNN)` | Primera implementación de un REQ. | `feat(REQ-AUTH-001): añadir login con Google` |
| `feat(REQ-XXX-NNN change-NNN)` | Implementación de un Delta Spec sobre REQ existente. | `feat(REQ-AUTH-001 change-002): sesión a 30 min` |
| `fix(ERR-NNN)` | Corrección de un error documentado. | `fix(ERR-001): manejar cookies bloqueadas en OAuth callback` |
| `docs(REQ-XXX-NNN)` | Solo cambio de spec (papel), sin código. | `docs(REQ-AUTH-001): añadir change-002 (sesión 30 min)` |
| `refactor(REQ-XXX-NNN)` | Refactor sin cambio funcional. | `refactor(REQ-AUTH-001): extraer SessionExpiryWarning a componente compartido` |
| `chore(db)` | Tareas de mantenimiento de BD. | `chore(db): regenerate ER diagram` |
| `chore(ci)` | Tareas de mantenimiento de CI. | `chore(ci): bump node a 20` |
| `chore(deps)` | Bumps de dependencias. | `chore(deps): bump prisma a 5.10` |
| `perf(REQ-XXX-NNN)` | Optimización de performance sin cambio funcional. | `perf(REQ-PAY-001): cachear lookup de país` |

## Por qué importan los prefijos

[`/audit`](../workflows/audit.md) usa el prefijo del commit message para **clasificar automáticamente** qué hacer cuando detecta un commit no asociado a un manifest:

- `feat:`, `refactor:`, `perf:` → **cambio de requisito candidato** → proponer crear/actualizar REQ.
- `fix:`, `bug:`, `hotfix:` → **corrección de error candidato** → proponer crear `ERR-NNN.md`.
- `chore:`, `docs:`, `style:` → **no requiere acción** (cambios meta).
- Sin prefijo o ambiguo → **preguntar al usuario**.

Sin esta convención, `/audit` no puede distinguir cambios y la metodología pierde una de sus capas más valiosas (la distinción entre cambio de requisito y corrección de error).

## Reglas adicionales

- **Una línea de asunto** (no más de 80 chars).
- **Cuerpo opcional** explicando el "por qué" cuando el "qué" no es obvio.
- **Referenciar ERR / REQ siempre** en el asunto. Sin esa referencia, `/audit` no puede asociar el commit a su spec.
- **No mezclar varios REQs en un commit.** Si un cambio toca múltiples REQs (típico tras `/change-req`), hacer commits separados por REQ. Excepción: si el cambio es atómico y los REQs están fuertemente acoplados, mencionar todos en el asunto: `feat(REQ-AUTH-001, REQ-AUTH-002 change-001): unificar TTL de sesiones`.

## Cuando NO hay flujo de PR

Si el equipo trabaja directamente sobre `main` (sin PRs), las convenciones siguen aplicando — `/audit` las consume igual. La activación de PRs en el futuro consiste solo en habilitar branch protection; el resto no cambia.
