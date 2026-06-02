# Plantilla: `initial.md` (creación de un requisito)

> Primer estado del REQ, generado por [`/new-req`](../workflows/new-req.md).
>
> **Inmutable.** Una vez creado, NO se modifica. Cualquier cambio futuro se expresa como un `change-NNN.md` en la misma carpeta. Ver [`change.md`](change.md).

## Plantilla

```markdown
---
id: REQ-AUTH-001
title: Login con Google
status: draft                          # draft | aprobado | implementado | deprecado
owner: <nombre o email>
created: 2026-06-01
tags: [autenticacion, oauth, google]
db_entities: [users, sessions, oauth_accounts]
ui_components: [LoginPage, OAuthButton, AuthCallback]
dependencies:
  needs: []                            # IDs de REQs que este requisito necesita
  needed_by: []                        # Se llena automáticamente cuando otro REQ depende de este
---

# REQ-AUTH-001 — Login con Google

## Contexto y motivación
<Por qué este requisito existe. Vínculo a docs/vision.md o docs/personas.md cuando aplique.>

## Comportamiento esperado
<Descripción funcional en lenguaje natural. Qué hace el sistema cuando el usuario interactúa.>

## Criterios de aceptación
- [ ] Given <precondición>, When <acción>, Then <resultado esperado>
- [ ] Given ..., When ..., Then ...

## Entidades de base de datos afectadas
- `users` — se crea o vincula un registro al iniciar sesión.
- `oauth_accounts` — almacena el `provider_id` de Google.
- `sessions` — se crea una sesión activa.

## Componentes de UI/Frontend afectados
- `LoginPage` — renderiza botón de Google.
- `OAuthButton` — componente compartido.
- `AuthCallback` — ruta `/auth/callback/google`.

## Dependencias con otros requisitos
- Necesita: ninguno.
- Necesitado por: (se completa cuando otros REQs lo referencien).

## Notas
<Anything relevante que no encaje arriba.>
```

## Semántica de los campos

| Campo | Significado |
|---|---|
| `id` | Identificador único. Ver [`../concepts/conventions.md`](../concepts/conventions.md). |
| `title` | Título corto, legible para humanos. |
| `status` | Ciclo de vida del REQ. Empieza en `draft`. |
| `owner` | Quien propuso o aprueba el REQ. |
| `created` | Fecha de creación ISO. |
| `tags` | Etiquetas libres para búsqueda. |
| `db_entities` | Tablas/colecciones afectadas. Permite al planner detectar impacto en cambios de BD. |
| `ui_components` | Componentes/pantallas afectadas. Permite al planner detectar impacto en cambios de UI. |
| `dependencies.needs` | REQs de los que este depende. El planner los considera en el grafo. |
| `dependencies.needed_by` | REQs que dependen de este. Se llena automáticamente cuando otro REQ añade este a su `needs`. |

## Lifecycle

- `initial.md` se crea **una vez** con [`/new-req`](../workflows/new-req.md).
- Su contenido **nunca** se modifica. Si el REQ evoluciona, se crea `change-001.md`, `change-002.md`, etc.
- El estado vigente del REQ se lee de `INDEX.md`, NO de `initial.md`. Ver [`INDEX.md`](INDEX.md).
- Cuando el REQ se deprecia, el `INDEX.md` cambia `status: deprecado` y enlaza al sustituto, pero `initial.md` permanece intacto como evidencia histórica.
