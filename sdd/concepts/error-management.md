# Gestión de errores

> **Required reading:** [`principles.md`](principles.md).
>
> **Relacionado:** [`../templates/error.md`](../templates/error.md), [`../workflows/audit.md`](../workflows/audit.md).

Sección dedicada porque en vibe coding los errores son inevitables y, bien gestionados, son la fuente más rica de mejora del spec.

## 1. Distinción crítica: cambio de requisito vs corrección de error

| | Cambio de requisito | Corrección de error |
|---|---|---|
| **Causa** | El contrato del producto cambia. El comportamiento esperado es distinto. | El comportamiento real diverge del comportamiento ya pactado. |
| **Genera** | Nuevo `change-NNN.md` en el REQ + actualización de `INDEX.md` | Nuevo `ERR-NNN.md` en `errors/` del REQ |
| **¿Actualiza spec?** | Sí, es la razón del cambio | A veces (si reveló ambigüedad). Si sí, también se crea un `change-NNN.md`. |
| **Quién lo decide** | Owner del REQ (en checkpoint 1 de `/change-req`) | Cualquier dev al detectar el bug |

**Regla práctica:** si la pregunta "¿esto rompe la promesa que le hicimos al usuario?" se responde **sí, pero queremos cambiar la promesa** → cambio de requisito. Si se responde **no, la promesa sigue válida, esto es código incorrecto** → error.

## 2. Categorías de error

Cada `ERR-NNN.md` declara su `categoria` en el frontmatter:

- **`alucinacion_ia`** — La IA inventó una API, librería, comportamiento o asumió algo no especificado. **Signal:** revisar prompts y mejorar contexto en `CLAUDE.md`.
- **`spec_ambiguo`** — El requisito permitía múltiples interpretaciones razonables y la IA escogió una incorrecta. **Signal:** actualizar el `change-NNN.md` con un ADDED que cierre la ambigüedad.
- **`regresion`** — Un cambio rompió un comportamiento de otro REQ. **Signal:** el agente planner falló en detectar el impacto; revisar grafo de dependencias.
- **`bug_humano`** — Código modificado a mano fuera del flujo `/change-req` introdujo el bug. **Signal:** ejecutar [`/audit`](../workflows/audit.md) más seguido.

## 3. Errores que afectan a múltiples REQs

Cuando un error toca varios REQs, sigue esta regla:

1. **Identificar REQ principal**: el más afectado, o el primero donde se detectó.
2. El archivo `ERR-NNN.md` vive **en la carpeta del REQ principal**: `requirements/<dominio>/REQ-<PRINCIPAL>/errors/ERR-NNN-<slug>.md`.
3. En el frontmatter del error, `reqs_afectados` lista todos los REQs tocados.
4. En el `INDEX.md` de cada REQ secundario afectado, en la sección "Errores relacionados en otros REQs", se añade una línea referenciando: `[[ERR-NNN del REQ-PRINCIPAL]]`.

Esto evita duplicación de contenido manteniendo trazabilidad bidireccional.

## 4. Ciclo de vida de un error

1. **Detección** — Alguien (humano o agente) ve el bug. Estado: `detectado`.
2. **Triage** — Se clasifica categoría y se identifican REQs afectados. Si requiere investigación → `en_investigacion`.
3. **Causa raíz** — Se documenta en el `ERR-NNN.md`: síntoma, causa, prompt original (si fue IA).
4. **Solución** — Se implementa. Pasa a `resuelto`.
5. **Acción preventiva** — Si la categoría es `spec_ambiguo` o `alucinacion_ia`, el error debe generar un cambio en el spec (`change-NNN.md` que cierre la ambigüedad o instrucción en `CLAUDE.md` que evite la alucinación). Esto se documenta en la sección "Acción preventiva en el spec" del `ERR-NNN.md`.
6. **Aceptación** — En casos raros, un error se documenta y se acepta sin resolver (ej. limitación conocida de una librería externa). Estado: `aceptado`.

## 5. Por qué guardar el prompt original

En errores categoría `alucinacion_ia`, el campo "Prompt original" es crítico:

- Sirve como **caso de prueba** para evaluar futuras versiones del modelo o sesiones nuevas.
- Permite identificar **patrones de prompts frágiles** (ej. "siempre que pido OAuth sin especificar fallbacks, la IA falla").
- Alimenta `CLAUDE.md` con instrucciones que prevengan la recurrencia.

## 6. Cómo registrar un error nuevo

Ver plantilla en [`../templates/error.md`](../templates/error.md). Flujo resumido:

1. Identificar REQ principal y secundarios afectados.
2. Crear `requirements/<dominio>/REQ-<PRINCIPAL>/errors/ERR-NNN-<slug>.md` desde plantilla.
3. Rellenar: síntoma, causa raíz, solución, categoría, prompt original (si aplica), acción preventiva.
4. Si la categoría exige actualizar el spec → invocar [`/change-req`](../workflows/change-req.md) con el contenido de "Acción preventiva en el spec".
5. Añadir línea de "Errores conocidos" en el `INDEX.md` del REQ principal.
6. Añadir línea de "Errores relacionados en otros REQs" en los INDEX de los REQs secundarios.
7. Añadir fila en `ledger.md` global con tipo `error`.
