# Workflow: `/audit`

> Detecta divergencia entre código y requisitos (spec drift).
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../concepts/principles.md`](../concepts/principles.md)
> - [`../concepts/error-management.md`](../concepts/error-management.md) (crítico: distinguir cambio vs error)
> - [`../concepts/context-loading.md`](../concepts/context-loading.md)

## Propósito

Cuando alguien (humano o IA) modifica código sin pasar por [`/change-req`](change-req.md), el spec y el código se desincronizan. `/audit` lo detecta y propone cómo corregirlo.

## Regla crítica

`/audit` debe **distinguir entre cambio de requisito y corrección de error**. Son cosas DIFERENTES:

- **Cambio de requisito** → versionar el REQ con un `change-NNN.md` retroactivo.
- **Corrección de error** → crear un `ERR-NNN.md`, NO versionar el REQ.

La heurística está en el commit message (ver paso 3 abajo). Si el commit message es ambiguo, **preguntar al usuario** antes de tomar acción.

## Pasos

1. **Escanear código fuente.** Listar archivos en `src/` (o las carpetas que `docs/tech-stack.md` indique). Para cada archivo, recoger su path.

2. **Cruzar con manifests.** Cargar todos los `manifest.md` de los REQs (tier 2). Para cada archivo encontrado en paso 1:
   - Si está listado en algún manifest → OK.
   - Si NO está en ningún manifest → candidato a **drift**.

3. **Leer `git log` desde la última `/audit`** (registrada en `ledger.md` global como fila tipo `audit`). Para cada commit que tocó un archivo en estado de drift:
   - Si el commit message empieza con `fix:`, `bug:`, `hotfix:` → clasificar como **corrección de error candidato**. La IA propone crear un `ERR-NNN.md` en el REQ asociado (inferido de los archivos tocados → cuál es su REQ "más probable" según contenido).
   - Si el commit message empieza con `feat:`, `refactor:`, `perf:` → clasificar como **cambio de requisito candidato**. La IA propone crear un `change-NNN.md` retroactivo o un REQ nuevo (si es funcionalidad nueva).
   - Si el commit message empieza con `chore:`, `style:`, `docs:` o no sigue convención → preguntar al usuario.

4. **Generar reporte:**
   - Archivos huérfanos (no en ningún manifest) + commits asociados + clasificación propuesta.
   - REQs con `status: implementado` pero `manifest.md` vacío (otro tipo de drift: el código existe pero no se conoce qué archivos lo implementan).
   - REQs con `dependencies.needs` apuntando a REQs deprecados o inexistentes (referencias rotas).
   - REQs con `INDEX.md` cuyo `current_state` apunta a un `change-NNN.md` que no existe.
   - Inconsistencias entre `INDEX.md` "Estado consolidado actual" y el último `change-NNN.md` vigente (si el INDEX no fue reescrito tras un cambio).

5. **Para cada inconsistencia, presentar opciones al usuario:**
   - **Corrección de error candidato** → crear `ERR-NNN.md` en el REQ inferido. Ver [`../templates/error.md`](../templates/error.md).
   - **Cambio de requisito candidato** → invocar [`/change-req`](change-req.md) retroactivamente con el contenido del commit.
   - **Drift de código sin propósito claro** → preguntar al usuario qué hacer (eliminar el código, asignarlo a un REQ, crear un REQ nuevo).
   - **INDEX desactualizado** → sugerir [`/rebuild-index`](rebuild-index.md).
   - **Dependencias rotas** → proponer al usuario el fix.

6. **Registrar la audit en `ledger.md` global** con fila tipo `audit` + resumen del resultado.

## Outputs

- Reporte de drift estructurado.
- Para cada inconsistencia: clasificación + acción propuesta.
- Fila en `ledger.md` global con el resultado.

## Modo "profundo" (opcional)

Por defecto `/audit` opera en tier 0–2. Para una auditoría profunda (ej. después de detectar problemas serios), se puede ejecutar `/audit --deep`:
- Carga tier 3: lee `change-NNN.md` históricos, `initial.md` de cada REQ.
- Cruza el "Estado consolidado actual" de cada INDEX con la suma de los changes para detectar inconsistencias.
- Es muy costoso en contexto. Usar solo cuando sea necesario.

## Errores comunes

- **Clasificar mal cambio vs error.** Si la IA infiere `cambio de requisito` cuando debió ser `error` (o viceversa), el resultado contamina la metodología. Por eso **se pregunta al usuario en casos ambiguos** en lugar de actuar autónomamente.
- **No registrar la audit.** Si no se registra en `ledger.md`, la próxima audit no sabe desde qué commit empezar y duplicará reportes. Siempre añadir fila.
- **Ignorar el modo profundo.** Si un proyecto ha tenido mucho drift histórico, una audit ligera no detecta inconsistencias estructurales. Considerar `--deep` periódicamente.
