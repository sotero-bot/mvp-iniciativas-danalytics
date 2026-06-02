# Plantilla: `manifest.md` (trazabilidad a código)

> Lista los archivos de código del proyecto que implementan este REQ.
>
> Lo mantiene actualizado el agente **implementer** en la fase 3 de [`/change-req`](../workflows/change-req.md), tras tocar código.
>
> Es la base para que [`/audit`](../workflows/audit.md) detecte drift entre código y spec.

## Plantilla

```markdown
---
id: REQ-AUTH-001
last_synced: 2026-06-15
---

# Manifest — REQ-AUTH-001

## Archivos implementados

### Backend
- `src/auth/google_oauth.ts` — handler OAuth + intercambio de tokens
- `src/auth/session.ts` — creación y validación de sesión
- `src/db/users.ts` — upsert de usuario al iniciar sesión

### Frontend
- `src/pages/login.tsx` — pantalla de login
- `src/components/OAuthButton.tsx` — botón compartido
- `src/components/SessionExpiryWarning.tsx` — aviso de expiración (añadido en change-002)

### Tests
- `tests/auth/google_oauth.spec.ts`
- `tests/e2e/login-flow.spec.ts`

### Migraciones
- `database/migrations/0003_add_oauth_accounts.sql`
- `database/migrations/0007_session_ttl_30min.sql` (change-002)
```

## Semántica

| Campo | Significado |
|---|---|
| `id` | ID del REQ. |
| `last_synced` | Fecha del último update del manifest. |

## Secciones recomendadas

- **Backend** — Archivos de servidor/API.
- **Frontend** — Componentes, páginas, hooks.
- **Tests** — Unitarios, integración, e2e.
- **Migraciones** — Cambios de schema asociados al REQ.

Adaptar las secciones al stack del proyecto. Ejemplos: `Mobile`, `CLI`, `Workers`, `Jobs`, `Webhooks`, `Storybook`, etc.

## Convención de descripción

Cada archivo lleva una nota corta indicando su rol en el REQ. Si fue añadido o modificado en un `change-NNN` específico, anotarlo entre paréntesis al final: `(change-002)`. Esto facilita rastrear qué change introdujo cada cambio en el código.

## Lifecycle

- Se crea vacío con [`/new-req`](../workflows/new-req.md).
- Se llena/actualiza por el implementer en cada [`/change-req`](../workflows/change-req.md) tras tocar código.
- [`/audit`](../workflows/audit.md) lo cruza con `git log` y el árbol de `src/` para detectar:
  - **Archivos huérfanos**: tocados en commits pero no listados en ningún manifest.
  - **REQs sin código**: status `implementado` pero manifest vacío.

## Para agentes

- **Tier 2 de carga.** El manifest se lee bajo demanda, solo para REQs marcados como impactados por el planner. Ver [`../concepts/context-loading.md`](../concepts/context-loading.md).
- El implementer **debe** actualizar el manifest tras cada cambio de código. Si el commit toca archivos no listados, el manifest está desactualizado.
