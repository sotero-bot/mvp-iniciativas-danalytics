# Plantilla: `change-NNN.md` (Delta Spec — ADDED / MODIFIED / REMOVED)

> Cada cambio se expresa como **delta** sobre el estado anterior. NO se reescribe el requisito completo: se enumera explícitamente qué se añade, qué se modifica y qué se elimina.
>
> Generado por [`/change-req`](../workflows/change-req.md) tras aprobación humana en checkpoint 1.

## Plantilla

```markdown
---
id: REQ-AUTH-001
change: change-002
supersedes: change-001                   # Archivo al que este cambio reemplaza ("initial" si es el primero)
superseded_by: null                      # Se rellena cuando un change-NNN posterior lo supersede
status: aprobado                         # draft | aprobado | implementado | superseded
owner: <nombre>
created: 2026-06-15
reason: |
  Cliente pidió que la sesión expire en 30 minutos en lugar de 60
  por requerimiento de compliance.
---

# Change-002 — REQ-AUTH-001

## ADDED
- Nueva regla: tras 25 minutos de inactividad, el sistema muestra un aviso
  "Tu sesión expirará en 5 minutos. ¿Continuar?".
- Nueva entidad de UI: `SessionExpiryWarning`.

## MODIFIED
- **Duración de sesión**: pasa de 60 minutos a 30 minutos. (Antes: 60 min)
- **Criterio de aceptación 3**: ahora valida 30 min + aviso a los 25.

## REMOVED
- Se elimina el flag `extend_session_on_click` (ya no aplica).

## Impacto en BD
- Sin cambios de schema.
- `sessions.expires_at` ahora se calcula con TTL=30min.

## Impacto en UI
- `LoginPage`: sin cambios.
- `AuthCallback`: sin cambios.
- `SessionExpiryWarning`: nuevo componente.

## Impacto en otros REQs (detectado por agente planner)
- `REQ-AUTH-002-mfa`: la duración de sesión MFA debe alinearse → ver change-001 de REQ-AUTH-002.
```

## Semántica de los campos

| Campo | Significado |
|---|---|
| `id` | ID del REQ al que pertenece este cambio. |
| `change` | ID del cambio dentro del REQ. Secuencial: `change-001`, `change-002`, ... |
| `supersedes` | Archivo al que este cambio reemplaza. Para el primer cambio, valor `initial`. |
| `superseded_by` | Se rellena cuando un cambio posterior reemplaza a este. Inicialmente `null`. |
| `status` | Ciclo de vida del change. Pasa por `draft` → `aprobado` → `implementado` → eventualmente `superseded`. |
| `owner` | Quien propuso este cambio. |
| `created` | Fecha de creación ISO. |
| `reason` | Por qué se hace el cambio. Texto libre. Crítico para auditoría futura. |

## Secciones del cuerpo

- **ADDED** — Reglas, criterios, entidades o componentes **nuevos** que NO existían antes.
- **MODIFIED** — Reglas existentes cuyo comportamiento cambia. Debe indicar el estado anterior entre paréntesis (ej. "(Antes: 60 min)").
- **REMOVED** — Funcionalidades, reglas, flags o entidades que desaparecen.
- **Impacto en BD** — Cambios de schema, índices, datos. Si hay migración, mencionarla.
- **Impacto en UI** — Componentes nuevos, modificados o eliminados.
- **Impacto en otros REQs** — Detectado por el planner cruzando `dependencies.needed_by`. Lista de REQs que también deben versionarse en este cambio.

## Lifecycle del archivo

Cuando un `change-NNN.md` posterior lo supersede, ESTE archivo se actualiza **únicamente de dos formas** (única excepción a la regla de inmutabilidad de los changes):

1. **Frontmatter**: `status: superseded` y `superseded_by: change-NNN`.
2. **Banner** insertado al inicio del cuerpo (tras el frontmatter):

   ```
   > ⚠️ **ESTADO HISTÓRICO.** Superseded by [[change-NNN]]. El estado vigente del REQ vive en `INDEX.md`. NO usar como fuente de verdad actual.
   ```

El contenido ADDED/MODIFIED/REMOVED **nunca** se reescribe. Razón: los changes son log de auditoría, no documentación viva. La documentación viva está en [`INDEX.md`](INDEX.md).

## Para agentes

Los agentes **NO** leen `change-NNN.md` para conocer el estado actual del REQ. Leen el `INDEX.md`. Los changes solo se cargan bajo demanda en [`/rollback`](../workflows/rollback.md), [`/audit`](../workflows/audit.md) profundo, [`/rebuild-index`](../workflows/rebuild-index.md) o investigación forense. Ver [`../concepts/context-loading.md`](../concepts/context-loading.md).
