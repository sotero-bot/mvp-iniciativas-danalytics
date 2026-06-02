# Workflow: `/change-req`

> **El flujo más crítico de la metodología.** Tres agentes en serie, dos checkpoints humanos.
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../concepts/principles.md`](../concepts/principles.md)
> - [`../concepts/context-loading.md`](../concepts/context-loading.md) (tiers, aislamiento por subagente)
> - [`../templates/change.md`](../templates/change.md) (Delta Spec ADDED/MODIFIED/REMOVED)
> - [`../templates/INDEX.md`](../templates/INDEX.md) (cómo actualizar el "Estado consolidado actual")
> - [`../templates/manifest.md`](../templates/manifest.md)
> - [`../concepts/validation.md`](../concepts/validation.md) (tres capas de validación)
> - [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md)

## Visión general

Tres agentes independientes (planner → reviewer → implementer), cada uno como subagente con contexto aislado. Dos checkpoints humanos: uno en papel (Delta Specs aprobados antes de tocar código), otro en implementación (diff aprobado antes de commit).

## Setup de git (si el proyecto está versionado)

**ANTES de invocar al planner**, crear la rama de trabajo:

1. **Detectar git:**
   ```bash
   git rev-parse --git-dir 2>/dev/null
   ```

2. **Si está versionado:**
   - Árbol limpio. Si no, pedir al usuario que decida.
   - Estar en rama base (`main`). Si no, confirmar antes de cambiar.
   - Para el momento de crear la rama, todavía no sabemos el NNN del nuevo change ni los REQs afectados — eso lo determinará el planner. Por eso:
     - **Opción A (recomendada):** crear rama temporal con slug descriptivo del cambio del usuario ahora; renombrarla tras la fase 1:
       ```bash
       git checkout -b req/temp-<slug-corto-del-cambio>
       # ... tras planner identifica REQ principal e id de change ...
       git branch -m req/<REQ-ID>-change-<NNN>-<slug>
       ```
     - **Opción B:** invocar al planner primero (sin crear rama), y crear la rama al inicio del paso 7 (aplicar cambios de papel) cuando ya sabemos REQ + NNN.
     Elegir Opción B por simplicidad: el planner es read-only, no modifica archivos, así que se puede ejecutar antes de crear la rama.

3. **Si NO está versionado:** saltar este setup completamente.

**Naming de la rama** (cuando se cree en paso 7):
- Single REQ: `req/<REQ-ID>-change-<NNN>-<slug-corto>`. Ej: `req/REQ-AUTH-001-change-002-session-30min`.
- Multi-REQ: `req/<PRIMARY-REQ-ID>-change-<NNN>-multi-<slug-corto>`. Ej: `req/REQ-AUTH-001-change-002-multi-session-policy`.

Convención completa: [`../reference/commit-conventions.md`](../reference/commit-conventions.md).

## Fase 1 — Planner

**Carga necesaria:** [`../README.md`](../README.md) + [`../concepts/principles.md`](../concepts/principles.md) + [`../concepts/context-loading.md`](../concepts/context-loading.md) + este archivo + [`../templates/change.md`](../templates/change.md).

**Pasos:**

1. El usuario describe el cambio en lenguaje natural (ej. "ahora la sesión debe durar 30 minutos en vez de 60").

2. El agente **planner** carga:
   - Tier 0: `ledger.md` global + `docs/` (para contexto del proyecto).
   - Tier 1: `INDEX.md` de TODOS los REQs (sección "Estado consolidado actual" + dependencias).

3. Construye **grafo de impacto**:
   - REQs **directamente afectados** (mencionan entidades/componentes/comportamientos tocados por el cambio).
   - REQs **indirectos** vía `dependencies.needed_by`.
   - Entidades de BD que se tocan.
   - Migraciones de BD necesarias.

4. Tier 2: para los REQs marcados como impactados, lee su `manifest.md` para identificar archivos de código a modificar.

5. Emite el **plan**:
   - Lista de REQs a versionar.
   - Para cada REQ: borrador de `change-NNN.md` siguiendo el formato Delta Spec ADDED/MODIFIED/REMOVED.
   - Entidades BD afectadas + migración esperada.
   - Archivos UI/backend a tocar (desde los manifests).
   - Riesgos identificados.

**Output del planner:** un único mensaje estructurado. NO devuelve INDEX.md crudos.

## Fase 2 — Reviewer (sesión limpia, rol adversario)

**Carga necesaria:** [`../README.md`](../README.md) + [`../concepts/principles.md`](../concepts/principles.md) + este archivo (sección fase 2).

**Pasos:**

6. El agente **reviewer** recibe **únicamente** el output del planner. NO ve el contexto previo del planner, NO carga tier 1 por defecto.

7. Rol adversario: busca:
   - **Contradicciones** entre Delta Specs propuestos.
   - **Dependencias circulares** introducidas por el cambio.
   - **REQs implícitamente afectados** que el planner pasó por alto (sube a tier 1 solo si lo necesita).
   - **Riesgos de regresión** en REQs `needed_by`.

8. Emite un **veredicto**: `aprobar` | `aprobar con observaciones` | `rechazar con motivos`.

## CHECKPOINT 1 — humano (papel)

9. La sesión principal presenta al usuario:
   - Grafo de impacto del planner.
   - Delta Specs borrador.
   - Veredicto del reviewer + observaciones.

10. El usuario: aprueba / ajusta / aborta.

11. **Si aprueba**, la sesión principal ejecuta:

    a. **(Si hay git)** Crear la rama definitiva con el naming correcto ahora que conoce el REQ principal y el NNN del nuevo change:
       ```bash
       git checkout -b req/<REQ-ID>-change-<NNN>-<slug>
       ```

    b. Crear `change-NNN.md` en cada REQ afectado siguiendo el formato Delta Spec. Ver [`../templates/change.md`](../templates/change.md).

    c. **Reescribir la sección "Estado consolidado actual"** del `INDEX.md` de cada REQ con el nuevo comportamiento completo tras aplicar el delta. **No basta con cambiar el puntero `current_state`** — esta sección debe contener la descripción completa del REQ vigente. Ver [`../templates/INDEX.md`](../templates/INDEX.md).

    d. **Marcar el `change-NNN.md` anterior como `status: superseded`**, añadir `superseded_by: <nuevo>` en su frontmatter, e insertar el banner ⚠️ al inicio del cuerpo:
       ```
       > ⚠️ **ESTADO HISTÓRICO.** Superseded by [[change-NNN]]. El estado vigente del REQ vive en `INDEX.md`. NO usar como fuente de verdad actual.
       ```

    e. Añadir fila en `ledger.md` global y en cada `ledger.md` por REQ.

    f. **(Si hay git)** Commit del cambio de papel:
       ```
       git add requirements/ ledger.md
       git commit -m "docs(REQ-<ID> change-<NNN>): <título del cambio>"
       ```

## Fase 3 — Implementer (sesión limpia, tercer agente)

**Carga necesaria:** [`../README.md`](../README.md) + [`../concepts/principles.md`](../concepts/principles.md) + este archivo (sección fase 3) + [`../concepts/validation.md`](../concepts/validation.md) + [`../templates/manifest.md`](../templates/manifest.md) + [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md).

**Pasos:**

12. El agente **implementer** recibe **únicamente** los `change-NNN.md` aprobados y los `manifest.md` de los REQs afectados. **NO ve** el plan original ni la discusión del reviewer.

13. Implementa el cambio:
    - Modifica código en los archivos listados en los manifests + nuevos si aplica.
    - Genera/aplica migración con el sistema correspondiente (ver [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md)).
    - Actualiza `manifest.md` con archivos nuevos/cambiados.

14. Corre validación en tres capas (ver [`../concepts/validation.md`](../concepts/validation.md)):
    - Tests automáticos (existentes + nuevos basados en criterios de aceptación del Delta Spec).
    - Smoke test en dev server local.
    - Genera checklist humano por REQ tocado.

## CHECKPOINT 2 — humano (implementación)

15. La sesión principal presenta:
    - Diff de código.
    - Tests creados + resultado de la suite.
    - Output del smoke test.
    - Checklist humano.

16. El usuario:
    - Marca el checklist a ojo.
    - Aprueba el commit, o pide ajustes.

17. **Si pide ajustes:** el implementer itera. El `change-NNN.md` **no cambia** salvo que se descubra una ambigüedad → en ese caso vuelve a fase 1.

18. **Si aprueba:**
    - El status del REQ pasa a `implementado` en `INDEX.md`.
    - El status del `change-NNN.md` aprobado pasa a `implementado`.
    - **(Si hay git)** Commit del código sobre la misma rama:
      ```
      git add .
      git commit -m "feat(REQ-<ID> change-<NNN>): <título del cambio>"
      ```
    - **(Si NO hay git)** Solo se actualizan los archivos en el filesystem. Sin commit.
    - Sigue convenciones de [`../reference/commit-conventions.md`](../reference/commit-conventions.md).

## Tras aprobar el cambio (si hay git)

- La rama `req/<REQ-ID>-change-<NNN>-<slug>` queda en local con **dos commits**:
  1. `docs(REQ-<ID> change-<NNN>): ...` — cambio de papel (tras checkpoint 1).
  2. `feat(REQ-<ID> change-<NNN>): ...` — código (tras checkpoint 2).
- Próximo paso del usuario:
  - `git push -u origin <branch>`.
  - Abrir PR.
  - Tras mergear, ejecutar [`/cleanup-branches`](cleanup-branches.md) para borrar la rama local.

## Outputs

- 1+ `change-NNN.md` nuevos.
- 1+ `INDEX.md` con "Estado consolidado actual" reescrito.
- 1+ `change-NNN.md` anteriores marcados como `superseded`.
- Migración(es) de BD generada(s) y aplicada(s).
- Código modificado + tests pasando.
- Commit creado.
- Filas en ledger global y por REQ.

## Errores comunes

- **El planner no detecta un REQ impactado** (gap en `dependencies.needed_by`). El reviewer lo cubre como red de seguridad. Si llega a producción, se documenta como error categoría `regresion` en el REQ que se rompió.
- **El implementer ve el plan original.** Romper aislamiento contamina su contexto y le permite "corregir" decisiones ya aprobadas. NO debe pasar.
- **Olvidar reescribir "Estado consolidado actual" del INDEX.** El INDEX queda desactualizado y la próxima `/change-req` operará sobre estado falso. Si pasa, ejecutar [`/rebuild-index`](rebuild-index.md).
- **Implementer auto-validando.** Los tests deben derivarse de los criterios de aceptación del Delta Spec, NO del código que el implementer escribió. Ver [`../concepts/validation.md`](../concepts/validation.md).
