# Convenciones

> **Required reading:** [`principles.md`](principles.md).

## IDs de requisitos

- Formato: `REQ-<DOMINIO>-<NNN>`
- Ejemplos: `REQ-AUTH-001`, `REQ-PAY-014`, `REQ-ONBOARD-003`
- Dominio en MAYÚSCULAS, 3–8 letras, derivado de la carpeta del dominio.
- `NNN` es secuencial **dentro del dominio** (no global), 3 dígitos con padding.

## IDs de errores

- Formato: `ERR-<NNN>` dentro de la carpeta `errors/` del REQ "principal" afectado.
- Numeración local al REQ principal (no global).
- Si afecta a varios REQs, vive en el principal y los demás referencian con `[[ERR-NNN del REQ-XXX]]`. Ver [`error-management.md`](error-management.md).

## IDs de decisiones

- Formato: `ADR-<NNN>-<slug>` **global** del proyecto.
- Ejemplos: `ADR-001-elegir-framework.md`, `ADR-002-estrategia-cache.md`.

## Estados del ciclo de vida de un REQ

Cada REQ tiene un único estado en cada momento, declarado en el frontmatter de su `INDEX.md`:

| Estado | Significado |
|---|---|
| `draft` | En discusión o redacción. No se debe implementar. |
| `aprobado` | Aprobado por el owner. Listo para implementar. |
| `implementado` | Código en producción + tests pasando + manifest actualizado. |
| `deprecado` | Reemplazado o eliminado. NO borrar archivos: marcar y enlazar al sustituto. |

## Estados del ciclo de vida de un change-NNN.md

| Estado | Significado |
|---|---|
| `draft` | Recién creado, sin aprobar. |
| `aprobado` | Aprobado en checkpoint 1 de `/change-req`. |
| `implementado` | Implementado + tests verdes + commit hecho. |
| `superseded` | Reemplazado por un `change-NNN` posterior. Se marca con `superseded_by` y banner ⚠️. |

## Estados del ciclo de vida de un error

| Estado | Significado |
|---|---|
| `detectado` | Bug visto, sin investigar. |
| `en_investigacion` | Triage en curso. |
| `resuelto` | Solucionado, validado. |
| `aceptado` | Conocido pero no se va a arreglar (limitación externa, costo desproporcionado). |

## Naming dentro de la carpeta de un REQ

| Archivo | Rol |
|---|---|
| `initial.md` | Primer estado del requisito al ser creado |
| `change-NNN.md` | Cada cambio incremental en formato Delta Spec |
| `INDEX.md` | Estado consolidado actual + tabla cronológica |
| `ledger.md` | Refactor Ledger detallado del REQ |
| `manifest.md` | Lista de archivos de código que implementan este REQ |
| `errors/ERR-NNN-<slug>.md` | Archivos de error |
| `archive/` | (opcional) Changes históricos compactados — ver [`../workflows/compact-req.md`](../workflows/compact-req.md) |

## Idioma

El idioma de la documentación generada (REQs, errores, ledger) se elige al ejecutar [`/init-project`](../workflows/init-project.md). Los **keywords técnicos** permanecen siempre en inglés:

- IDs: `REQ-AUTH-001`, `ERR-001`, `ADR-001`.
- Nombres de slash commands: `/change-req`, `/audit`, etc.
- Campos de frontmatter: `id`, `status`, `created`, `owner`, `dependencies`, etc.
- Estados: `draft`/`aprobado`/`implementado`/`deprecado` permiten variantes ES/EN — elegir uno y mantenerlo consistente en todo el proyecto.

## Convenciones de naming de archivos de código y commits

Ver [`../reference/commit-conventions.md`](../reference/commit-conventions.md).
