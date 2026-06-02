# Plantilla: `INDEX.md` (estado consolidado actual del REQ)

> **El archivo más crítico de un REQ.** Es la única fuente de verdad del estado vigente.
>
> Los agentes leen este archivo para entender qué hace HOY el requisito. NO reconstruyen el estado leyendo `initial.md + change-001 + change-002 + …`.
>
> **Se reescribe íntegramente en cada [`/change-req`](../workflows/change-req.md)** (paso 7, antes del checkpoint 2). Ver [`../concepts/context-loading.md`](../concepts/context-loading.md).

## Plantilla

```markdown
---
id: REQ-AUTH-001
current_state: change-002                # Cuál de los .md refleja el estado vivo
status: implementado                     # draft | aprobado | implementado | deprecado
last_updated: 2026-06-15
---

# REQ-AUTH-001 — Login con Google

## Estado actual
**Versión vigente:** `change-002.md`
**Estado:** `implementado`
**Última actualización:** 2026-06-15

## Estado consolidado actual
<Descripción COMPLETA del comportamiento vigente del requisito tras aplicar todos los cambios.
Esta sección es la ÚNICA fuente de verdad del estado actual del REQ. Los agentes la leen
para entender qué hace HOY el requisito SIN necesidad de leer `initial.md` ni los `change-NNN.md`
históricos.

Debe contener:
- Comportamiento esperado completo (lo que el sistema hace hoy).
- Criterios de aceptación vigentes (los que aplican tras todos los changes).
- Entidades de BD afectadas en su estado actual.
- Componentes UI afectados en su estado actual.
- Dependencias actuales (`needs` y `needed_by` vigentes).

Esta sección se REESCRIBE íntegra en cada /change-req. Es la única forma de evitar que los
agentes reconstruyan el estado leyendo el historial completo — lo que llenaría el contexto
y mezclaría estados ya superados con el vigente.>

## Historial de versiones

| Versión | Fecha | Tipo | Autor | Resumen |
|---|---|---|---|---|
| `initial.md` | 2026-06-01 | creación | sotero | Login con Google con sesión de 60 min |
| `change-001.md` | 2026-06-08 | MODIFIED | sotero | Añadido "recordar dispositivo" |
| `change-002.md` | 2026-06-15 | MODIFIED | sotero | Sesión a 30 min por compliance |

## Errores conocidos
- [[ERR-001]] — Loop infinito en redirect cuando cookies bloqueadas (resuelto).
- [[ERR-002]] — Token no expiraba en sesiones MFA (resuelto, reveló spec ambiguo → change-002).

## Errores relacionados en otros REQs
<Solo si este REQ es secundario en un error multi-REQ; ej.: "[[ERR-001 de REQ-PAY-001]]".>
```

## Semántica de los campos

| Campo | Significado |
|---|---|
| `id` | ID del REQ. |
| `current_state` | Nombre del archivo `.md` que actualmente refleja el estado vivo del REQ. |
| `status` | Ciclo de vida del REQ. Ver [`../concepts/conventions.md`](../concepts/conventions.md). |
| `last_updated` | Fecha del último cambio aplicado a este INDEX. |

## Secciones del cuerpo

- **Estado actual** — Resumen breve: qué versión vigente, estado, fecha.
- **Estado consolidado actual** — La sección clave. Descripción COMPLETA del comportamiento vigente. Debe ser autosuficiente: un agente que solo lea esta sección debe entender qué hace el REQ hoy, sin necesidad de leer ningún otro archivo de la carpeta.
- **Historial de versiones** — Tabla cronológica con una fila por archivo (`initial.md` y cada `change-NNN.md`).
- **Errores conocidos** — Lista de `ERR-NNN.md` propios de este REQ (vive en `errors/`).
- **Errores relacionados en otros REQs** — Solo si este REQ es secundario en un error multi-REQ. Referencia al ERR del REQ principal. Ver [`../concepts/error-management.md`](../concepts/error-management.md).

## Lifecycle

- Se crea con [`/new-req`](../workflows/new-req.md) apuntando a `initial.md` como `current_state`.
- Se actualiza con cada [`/change-req`](../workflows/change-req.md): el paso 7 del flujo **reescribe** la sección "Estado consolidado actual" completa, actualiza `current_state` al nuevo `change-NNN.md`, añade fila al historial.
- Si se corrompe o desactualiza, se puede regenerar con [`/rebuild-index REQ-XXX`](../workflows/rebuild-index.md).

## Para agentes

- **Tier 1 de carga.** Los agentes leen el `INDEX.md` de TODOS los REQs para construir el grafo de impacto. Ver [`../concepts/context-loading.md`](../concepts/context-loading.md).
- **Nunca leas `initial.md` ni los `change-NNN.md` para conocer el estado actual** — siempre lee este archivo.
- Si la sección "Estado consolidado actual" parece incompleta o desactualizada, **NO** intentes reconstruirla del historial silenciosamente. Reporta la inconsistencia y sugiere `/rebuild-index`.
