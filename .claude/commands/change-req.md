---
description: EL flujo crítico de SDD. Orquesta 3 subagentes (planner → reviewer → implementer) con 2 checkpoints humanos. Cualquier cambio funcional pasa por aquí.
---

# /change-req — Cambio con flujo de 3 agentes

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/README.md`
3. `sdd/workflows/change-req.md` (el manual COMPLETO del flujo, pasos 1-18)
4. `sdd/concepts/context-loading.md`

## Tu rol

Eres **ORQUESTADOR**. NO haces tú el análisis, ni la revisión, ni la implementación. Coordinas a los 3 subagentes y gestionas los 2 checkpoints humanos.

## Setup de git (OBLIGATORIO — ejecutar antes de fase 1)

1. Detectar git:

   ```bash
   git rev-parse --git-dir 2>/dev/null
   ```

   - Si falla → no hay git. Saltar todo el flujo de ramas.
   - Si tiene éxito → continuar.

2. Verificar árbol limpio:

   ```bash
   git status --porcelain
   ```

   Si hay cambios sin commitear, preguntar al usuario antes de continuar.

3. Detectar rama base real:

   ```bash
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
   ```

   Si no hay remote, usar `git branch --show-current`. Guardar como `<rama-base>`.

4. Hacer checkout a la rama base:
   ```bash
   git checkout <rama-base>
   ```

**NO crear rama todavía** — el planner es read-only. La rama se crea en paso 7, cuando ya se conoce REQ principal + NNN del change.

## Flujo

### Fase 1 — Planner

Invoca al subagente `planner` con la descripción del cambio del usuario:

```
Cambio solicitado: $ARGUMENTS
```

Recibes del planner: grafo de impacto + Delta Specs borrador + riesgos.

**Importante:** si el planner reporta que el problema es en realidad un **bug** (corrección de error, no cambio de requisito), detén el flujo y deriva:

> Esto parece una corrección de error, no un cambio de requisito.
> Sugerencia: usa la skill `sdd-classify-issue` o crea un `ERR-NNN.md` siguiendo `sdd/concepts/error-management.md`.

### Fase 2 — Reviewer

Invoca al subagente `reviewer` pasándole **ÚNICAMENTE** el output del planner (NO le des contexto adicional ni los `INDEX.md` crudos).

Recibes del reviewer: veredicto + observaciones.

### CHECKPOINT 1 — Humano (papel)

Presenta al usuario un resumen compacto:

```
## Cambio propuesto
[Descripción en lenguaje natural]

## Impacto detectado
- REQs afectados: [lista]
- Entidades BD: [lista]
- Archivos de código: ~N archivos

## Delta Specs propuestos
[Resumen de uno por REQ]

## Veredicto del reviewer
[APROBAR / APROBAR_CON_OBSERVACIONES / RECHAZAR]
[Observaciones si las hay]

## Preguntas pendientes (si las hay)
[Lista]

---
¿Procedo? [APROBAR / AJUSTAR / ABORTAR]
```

Espera respuesta EXPLÍCITA del usuario.

**Si APROBAR:** ejecuta los cambios de papel: 0. **(Si hay git)** Crear rama ahora que conocemos REQ principal + NNN:

```
git checkout -b req/<REQ-ID>-change-<NNN>-<slug>
```

(Multi-REQ: `req/<PRIMARY-REQ-ID>-change-<NNN>-multi-<slug>`.)

1. Crear `change-NNN.md` en cada REQ afectado (formato Delta Spec — `sdd/templates/change.md`).
2. **Reescribir la sección "Estado consolidado actual"** del `INDEX.md` de cada REQ con el comportamiento completo tras aplicar el delta. NO basta con cambiar `current_state`.
3. Marcar el `change-NNN.md` anterior como `status: superseded`, añadir `superseded_by: <nuevo>` en su frontmatter, e insertar banner ⚠️ al inicio del cuerpo.
4. Añadir filas en `ledger.md` global y en cada `ledger.md` por REQ.
5. **(Si hay git)** Commit del cambio de papel:
   ```
   git add requirements/ ledger.md
   git commit -m "docs(REQ-<ID> change-<NNN>): <título del cambio>"
   ```

### Fase 3 — Implementer

Invoca al subagente `implementer` pasándole **ÚNICAMENTE** los Delta Specs aprobados + los `manifest.md` de los REQs afectados.

Recibes del implementer: diff + migraciones generadas + tests creados + resultado de validación (3 capas).

### CHECKPOINT 2 — Humano (implementación)

Presenta al usuario:

```
## Implementación lista para commit

### Archivos modificados/creados
[Lista]

### Migraciones
[Lista, con aviso si alguna es destructiva]

### Validación
- Tests automáticos: ✅ N pasados / ❌ M fallaron
- Smoke test: ✅ / ❌
- Checklist humano:
  - [ ] [Caso 1]
  - [ ] [Caso 2]
  ...

---
Marca el checklist a ojo y aprueba para commit. [COMMIT / AJUSTAR / ABORTAR]
```

**Si COMMIT:**

1. Actualizar status del REQ a `implementado` en INDEX.
2. Actualizar status del `change-NNN.md` aprobado a `implementado`.
3. **(Si hay git)** Commit del código sobre la misma rama:
   ```
   git add .
   git commit -m "feat(REQ-<ID> change-<NNN>): <título>"
   ```
   (Si NO hay git: solo se actualizan archivos en filesystem, sin commit.)
4. Informar al usuario:
   - Si hay git: "Rama `req/<REQ-ID>-change-<NNN>-<slug>` con 2 commits (papel + código). Próximo: `git push -u origin <branch>` + abrir PR. Tras mergear: `/cleanup-branches`."
   - Si NO hay git: "Cambio aplicado en filesystem."

**Si AJUSTAR:** el implementer itera. El `change-NNN.md` NO cambia salvo que aparezca una ambigüedad — en cuyo caso vuelve a fase 1.

## Modo de operación

El usuario describe el cambio en una frase. A partir de ahí:

- Ejecutas las 3 fases SIN pedir confirmaciones intermedias.
- Los únicos puntos de interrupción son los 2 checkpoints.
- En los checkpoints, presentas info **compacta y estructurada** — no echo de los `INDEX.md` crudos, no transcripciones largas, no dudas internas. Solo lo necesario para que el usuario decida.

## Restricciones

- **NO hagas tú el análisis.** Para eso está el planner. Si te das cuenta de que estás "pensando" en impacto, detente e invoca al planner.
- **NO le des al reviewer el contexto del planner.** Solo el output.
- **NO le des al implementer el plan original ni la discusión del reviewer.** Solo los Delta Specs aprobados.
- **NO commitees sin checkpoint 2 humano.** Es regla dura.
- **Si una capa de validación falla en fase 3,** NO presentes checkpoint 2 todavía. El implementer itera o el flujo vuelve a fase 1.
