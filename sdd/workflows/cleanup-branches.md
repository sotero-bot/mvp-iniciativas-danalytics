# Workflow: `/cleanup-branches`

> Borra ramas locales cuyo PR ya está mergeado (o cuyos commits ya están en `main`).
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../reference/commit-conventions.md`](../reference/commit-conventions.md) (naming de ramas)

## Cuándo usarlo

- Tras mergear PR(s) generadas por [`/new-req`](new-req.md), [`/change-req`](change-req.md) o [`/rollback`](rollback.md), las ramas locales siguen en el repo. Este comando las limpia.
- Periódicamente (semanal, tras sprints) para mantener `git branch` aseado.
- **Solo aplica en proyectos versionados con git.**

## Precondiciones

- Proyecto versionado con git.
- Idealmente, `gh` CLI instalado y autenticado (para detectar PRs mergeados con precisión). Si no, fallback a `git branch --merged` con limitaciones.

## Pasos

### 1. Detectar disponibilidad de `gh`

```bash
command -v gh
```

### 2. Listar candidatas a borrar

**Si `gh` está disponible (recomendado):**

a. Listar PRs mergeados recientes:
   ```bash
   gh pr list --state merged --json headRefName,number,title,mergedAt --limit 100
   ```

b. Listar ramas locales que siguen la convención SDD:
   ```bash
   git branch --format='%(refname:short)' | grep -E '^(req|err|rollback)/'
   ```

c. Cruzar: ramas locales cuyo `headRefName` aparece en la lista de PRs mergeados.

**Si `gh` NO está disponible (fallback):**

a. Listar ramas locales ya fusionadas a la base:
   ```bash
   git fetch origin --prune
   git branch --merged origin/main | grep -E '^\s*(req|err|rollback)/' | grep -v '^\*'
   ```

b. **Aviso:** este fallback NO detecta squash-merges (que son comunes en GitHub/GitLab). Si tu equipo usa squash-merge, considera instalar `gh` para resultados precisos.

### 3. Presentar al usuario

```
Ramas candidatas a borrar (PR mergeado detectado):

🟢 Seguras (PR mergeado y rama merged en git):
  - req/REQ-AUTH-001-login-google (PR #42, merged 2026-06-10)
  - err/ERR-001-loop-redirect (PR #44, merged 2026-06-11)

🟡 PR mergeado pero rama NO marcada como merged en git (probable squash-merge):
  - req/REQ-AUTH-002-change-001-session-30min (PR #45, merged 2026-06-12)
    → Requiere `git branch -D` (force delete). Verificar primero que el commit
       mergeado contiene los cambios esperados.

¿Qué hago?
- [Borrar todas] (verdes con -d, amarillas con -D tras verificar)
- [Solo borrar las verdes]
- [Seleccionar manualmente]
- [Cancelar]
```

### 4. Si el usuario aprueba

a. Asegurar que estamos en la rama base:
   ```bash
   git checkout main && git pull
   ```

b. Para cada rama verde:
   ```bash
   git branch -d <rama>
   ```

c. Para cada rama amarilla aprobada explícitamente:
   ```bash
   git branch -D <rama>
   ```

d. Si alguna rama tiene cambios sin commitear o no fusionados que el usuario no aprobó borrar, omitirla y reportar.

### 5. Reportar

```
Resultado:
✓ req/REQ-AUTH-001-login-google
✓ err/ERR-001-loop-redirect
✓ req/REQ-AUTH-002-change-001-session-30min (force delete)
✗ req/REQ-PAY-003-checkout (omitida: tenía cambios locales sin commit)

3 ramas borradas. 1 omitida.
```

## Casos especiales

- **Squash-merge.** GitHub/GitLab a menudo aplican squash-merge. `git branch -d` falla porque la rama no está "merged" según git local (el commit original no está en main). La detección por `gh pr list` lo resuelve correctamente, requiriendo `-D` para el borrado tras confirmación del usuario.

- **Rama con commits no en el PR.** Si la rama tiene commits adicionales después del último merge (el dev pushea cambios tras el merge), advertir antes de borrar. NO borrar automáticamente.

- **Rama con cambios sin commitear (working tree).** Nunca borrar. Reportar advertencia al usuario.

- **PR cerrado sin mergear.** No incluir en la lista de candidatas. El usuario decide manualmente si borrar.

## Restricciones

- **No usar `git branch -D` (force delete) automáticamente.** Solo si el usuario aprueba explícitamente, y solo en casos de squash-merge confirmados por `gh`.
- **No borrar `main`, `master`, ni ramas de release** (`release/*`, `hotfix/*` que no sigan la convención SDD). El filtro por prefijo (`req/`, `err/`, `rollback/`) protege contra esto.
- **No tocar el remoto.** Solo borrado local. Las ramas remotas se limpian en GitHub/GitLab (configurable como auto-delete on merge) o por housekeeping del repo.
- **No mergees nada en este flujo.** El merge es el PR de GitHub/GitLab, no responsabilidad de este comando.
- **No fuerces nada sin verificación.** En caso de duda, omitir la rama y reportar al usuario para decisión manual.
