# Plantilla: `ledger.md` por REQ (Refactor Ledger detallado)

> Vive dentro de la carpeta del REQ: `requirements/<dominio>/REQ-<DOMINIO>-<NNN>/ledger.md`.
>
> Una fila por cambio aplicado a este REQ. Incluye changes, errores resueltos y cualquier intervención que tocó código asociado al REQ.

## Plantilla

```markdown
# Refactor Ledger — REQ-AUTH-001

| Fecha | Objetivo del cambio | Archivos planificados | Riesgos | Comando de verificación | Estado |
|---|---|---|---|---|---|
| 2026-06-08 | Añadir "recordar dispositivo" (change-001) | `src/auth/session.ts`, `src/components/RememberDevice.tsx`, migración 0005 | Tokens de larga vida sin rotación | `npm run test:auth && npm run e2e:login` | hecho |
| 2026-06-15 | Sesión a 30 min (change-002) | `src/auth/session.ts`, migración 0007, `SessionExpiryWarning.tsx` | Romper sesiones activas en producción | `npm run test:auth && pm2 logs en staging` | hecho |
| 2026-06-11 | Fix loop cookies bloqueadas (ERR-001) | `src/auth/google_oauth.ts`, `src/pages/login.tsx` | Regresión en flujo feliz | `npm run e2e:login -- --grep cookies` | hecho |
```

## Columnas

| Columna | Contenido |
|---|---|
| **Fecha** | ISO date del cambio. |
| **Objetivo del cambio** | Una frase. Si es un change, mencionar el ID; si es un fix de error, mencionar el ERR-ID. |
| **Archivos planificados** | Paths de los archivos que se planeó tocar. Útil después para `/audit` (cruzar con lo que realmente se tocó). |
| **Riesgos** | Riesgos identificados en el plan. Sirven como recordatorio para revisión retroactiva si algo se rompe. |
| **Comando de verificación** | El comando exacto que se corrió para validar (tests, smoke, etc.). |
| **Estado** | `planeado` / `en_progreso` / `hecho` / `revertido`. |

## Lifecycle

- Se crea vacío con [`/new-req`](../workflows/new-req.md).
- Se añade una fila cuando:
  - El planner confirma un plan en checkpoint 1 de [`/change-req`](../workflows/change-req.md) → estado `planeado` o `en_progreso`.
  - El implementer termina y pasa checkpoint 2 → estado `hecho`.
  - Se resuelve un `ERR-NNN.md` → fila tipo error.
  - [`/rollback`](../workflows/rollback.md) revierte un cambio → la fila original pasa a `revertido` y se añade una nueva fila "rollback de X".

## Relación con el ledger global

El [`ledger-global.md`](ledger-global.md) de la raíz del proyecto tiene una fila resumen por cada change importante de cualquier REQ. Este `ledger.md` por REQ es el detalle. Ambos se mantienen en sincronía:
- Cada fila aquí debe tener su contraparte en el ledger global (a no ser que sea un detalle interno).
- Cada fila en el ledger global referencia al ledger del REQ correspondiente.

## Para agentes

- **Tier 2 de carga.** Se lee solo en REQs marcados como impactados, o cuando el implementer necesita ver el historial de comandos de verificación usados.
- En [`/audit`](../workflows/audit.md): cruzar las filas con `git log` para detectar inconsistencias (commits sin fila en el ledger, filas sin commits asociados).
