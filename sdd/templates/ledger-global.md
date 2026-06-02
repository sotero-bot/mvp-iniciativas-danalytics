# Plantilla: `ledger.md` global del proyecto

> Vive en la raíz del proyecto: `<project-root>/ledger.md`.
>
> Resumen de un renglón por cambio importante de CUALQUIER REQ. Es el mapa de vista de pájaro del proyecto.

## Plantilla

```markdown
# Refactor Ledger Global

> Resumen de un renglón por cambio importante. Detalles completos en el ledger.md de cada REQ.

| Fecha | REQ | Tipo | Resumen | Link |
|---|---|---|---|---|
| 2026-06-01 | REQ-AUTH-001 | nuevo | Login con Google | [REQ-AUTH-001](requirements/auth/REQ-AUTH-001-login-google/ledger.md) |
| 2026-06-08 | REQ-AUTH-001 | change-001 | Añadido "recordar dispositivo" | [REQ-AUTH-001](requirements/auth/REQ-AUTH-001-login-google/ledger.md) |
| 2026-06-10 | REQ-AUTH-001 | error | ERR-001: loop cookies bloqueadas | [ERR-001](requirements/auth/REQ-AUTH-001-login-google/errors/ERR-001-loop-redirect.md) |
| 2026-06-15 | REQ-AUTH-001 | change-002 | Sesión a 30 min por compliance | [REQ-AUTH-001](requirements/auth/REQ-AUTH-001-login-google/ledger.md) |
```

## Columnas

| Columna | Contenido |
|---|---|
| **Fecha** | ISO date. |
| **REQ** | ID del REQ (`REQ-AUTH-001`, etc.). |
| **Tipo** | `nuevo` / `change-NNN` / `error` / `rollback` / `compact` / `deprecate`. |
| **Resumen** | Una frase descriptiva. |
| **Link** | Path al `ledger.md` del REQ o directamente al `ERR-NNN.md` cuando aplique. |

## Lifecycle

- Se crea por [`/init-project`](../workflows/init-project.md) vacío.
- Se añade una fila cada vez que ocurre un evento relevante en CUALQUIER REQ:
  - [`/new-req`](../workflows/new-req.md) crea un REQ → fila tipo `nuevo`.
  - [`/change-req`](../workflows/change-req.md) aprueba un Delta Spec → fila tipo `change-NNN`.
  - Se registra un error → fila tipo `error`.
  - [`/rollback`](../workflows/rollback.md) revierte → fila tipo `rollback`.
  - [`/compact-req`](../workflows/compact-req.md) compacta → fila tipo `compact`.
  - Un REQ pasa a `deprecado` → fila tipo `deprecate`.

## Para agentes

- **Tier 0 de carga.** Este archivo se carga SIEMPRE al inicio de cualquier operación SDD. Da el contexto temporal del proyecto sin necesidad de leer ningún REQ individual.
- Mantenerlo **conciso**: una fila = un renglón. Si una descripción se hace larga, recortarla y dejar el detalle en el ledger del REQ.
- Cuando el ledger global crece a más de ~200 filas, considerar archivarlo: mover las primeras N filas a `ledger-archive-<año>.md` y dejar solo el año en curso en `ledger.md`. (No es obligatorio, solo si se vuelve un problema de carga.)
