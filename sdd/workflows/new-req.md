# Workflow: `/new-req`

> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../concepts/principles.md`](../concepts/principles.md)
> - [`../concepts/conventions.md`](../concepts/conventions.md) (IDs, naming, estados)
> - [`../templates/initial.md`](../templates/initial.md)
> - [`../templates/INDEX.md`](../templates/INDEX.md)

Crea un nuevo requisito desde cero.

## Precondiciones

- `docs/` poblada con los 4 archivos rellenados. Si no, derivar a [`/init-project`](init-project.md).
- Identificar dominio del REQ (auth, payments, onboarding, etc.).

## Setup de git (si el proyecto está versionado)

Antes de crear archivos, detectar git y crear rama de trabajo:

1. **Detectar:**
   ```bash
   git rev-parse --git-dir 2>/dev/null
   ```

2. **Si está versionado:**
   - Verificar árbol limpio (`git status --porcelain` vacío). Si no, pedir al usuario que decida (stash, abortar, continuar).
   - Asegurar que estamos en la rama base (típicamente `main`). Si no, confirmar con el usuario antes de hacer `git checkout main`.
   - Crear y cambiar a la rama del REQ:
     ```bash
     git checkout -b req/<REQ-ID>-<slug>
     ```
     Ejemplo: `git checkout -b req/REQ-AUTH-001-login-google`. Convención completa en [`../reference/commit-conventions.md`](../reference/commit-conventions.md).
   - Si la rama ya existe, preguntar al usuario (¿continuar en ella, abortar, usar otro nombre?).
   - Todas las modificaciones de pasos siguientes ocurren en esta rama.

3. **Si NO está versionado:**
   - Saltar este setup. Las modificaciones ocurren directo en el filesystem.
   - (Opcional) Si parece apropiado, sugerir al usuario `git init`. No forzar.

## Pasos

1. **Preguntar al usuario:**
   - Dominio (sugerir si hay carpetas existentes en `requirements/`).
   - Título corto del requisito.
   - Descripción funcional en lenguaje natural.
   - Criterios de aceptación iniciales (al menos uno).

2. **Determinar ID.**
   - Escanear `requirements/<dominio>/` para encontrar el siguiente número disponible: `REQ-<DOMINIO>-<NNN>`.
   - Si el dominio no existe, crear la carpeta.

3. **Detectar entidades de BD candidatas.**
   - Cruzar la descripción del usuario con `database/schema.sql` (o `schema.prisma`).
   - Proponer entidades candidatas. El usuario confirma o ajusta.

4. **Detectar componentes UI candidatos.**
   - Cruzar con el código existente (búsqueda heurística en `src/` por nombres de componentes mencionados).
   - Proponer al usuario.

5. **Detectar dependencias con otros REQs.**
   - Buscar REQs que mencionen entidades o componentes solapados.
   - Proponer al usuario.

6. **Crear la estructura del REQ:**
   ```
   requirements/<dominio>/REQ-<DOMINIO>-<NNN>-<slug>/
   ├── initial.md         (rellenado desde plantilla con la info recopilada)
   ├── INDEX.md           (current_state: initial, status: draft)
   ├── ledger.md          (vacío con cabecera)
   ├── manifest.md        (vacío con frontmatter)
   └── errors/            (carpeta vacía)
   ```

7. **Actualizar dependencias bidireccionales:**
   - Si el REQ tiene `dependencies.needs: [REQ-X, REQ-Y]`, añadir a `REQ-X` y `REQ-Y` en su `dependencies.needed_by` este nuevo REQ.
   - Esto se hace editando los respectivos `INDEX.md` (sección dependencias).

8. **Añadir fila al `ledger.md` global** tipo `nuevo`. Ver [`../templates/ledger-global.md`](../templates/ledger-global.md).

## Outputs

- Carpeta del REQ creada con archivos esqueleto.
- `initial.md` rellenado con la información del usuario.
- `INDEX.md` con `current_state: initial`, `status: draft`.
- Dependencias bidireccionales actualizadas en REQs relacionados.
- Fila en `ledger.md` global.

## Estados al terminar

- El REQ queda en estado `draft`. El usuario lo revisa y, cuando esté listo, lo pasa a `aprobado` (manualmente o vía [`/change-req`](change-req.md) si necesita ajustes).
- Implementación: el REQ no se implementa al crearse. Se implementa después con [`/change-req`](change-req.md) o como parte de un sprint planeado.

## Tras crear el REQ (si hay git)

- La rama `req/<REQ-ID>-<slug>` queda en local con un commit inicial:
  ```
  feat(REQ-<ID>): crear requisito <slug>
  ```
  (Convención completa en [`../reference/commit-conventions.md`](../reference/commit-conventions.md).)
- Cuando esté listo para implementar:
  - `git push -u origin <branch>` y abrir PR.
  - Tras mergear el PR, ejecutar [`/cleanup-branches`](cleanup-branches.md) para borrar la rama local.
- Si el REQ se va a implementar inmediatamente en la misma sesión, no es obligatorio abrir PR antes — [`/change-req`](change-req.md) continuará en la misma rama y añadirá commits.

## Errores comunes

- **ID colisionando.** Si el siguiente `NNN` ya existe (por race condition entre devs), incrementar hasta encontrar libre. Reportar al usuario.
- **No actualizar `needed_by` en REQs apuntados.** Crítico para que el planner pueda detectar impacto en cascada. Doble-check al final del flujo.
- **Crear el REQ sin entidades ni componentes.** Si la descripción no permite identificar entidades de BD ni componentes UI, advertir al usuario: probablemente el requisito está mal formulado.
