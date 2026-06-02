---
description: EL flujo crítico de SDD. Orquesta 3 subagentes (planner → reviewer → implementer) con 2 checkpoints humanos. Cualquier cambio funcional pasa por aquí.
---

# /change-req — Cambio con flujo de 3 agentes

## Tu rol

Eres **ORQUESTADOR**. No haces el análisis, la revisión ni la implementación — coordinas 3 subagentes en serie y gestionas 2 checkpoints humanos. El comando termina siempre con archivos escritos y commit creado (si hay git).

---

## PASO 0 — Setup de git (OBLIGATORIO antes de invocar al planner)

```bash
git rev-parse --git-dir 2>/dev/null
```

- **Si falla** → no hay git. Continuar sin flujo de ramas.
- **Si tiene éxito** → ejecutar:

```bash
git status --porcelain
```

Si hay cambios sin commitear, preguntar al usuario antes de continuar.

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

Si no devuelve nada, usar `git branch --show-current`. Guardar como `<rama-base>`.

```bash
git checkout <rama-base>
```

> **NO crear rama todavía.** El planner es read-only. La rama se crea en el Paso 3 cuando ya se conoce REQ principal + NNN del change.

---

## PASO 1 — Planner (subagente, contexto aislado)

Invocar al subagente `planner` pasándole ÚNICAMENTE:

```
Cambio solicitado: <descripción del usuario>
```

El planner debe:

1. Cargar `ledger.md` global + `docs/` (contexto del proyecto).
2. Cargar `INDEX.md` de TODOS los REQs (solo sección "Estado consolidado actual" + dependencias).
3. Identificar REQs directamente afectados + REQs indirectos vía `needed_by`.
4. Cargar `manifest.md` de los REQs impactados (para identificar archivos de código).
5. Devolver: grafo de impacto + borrador de `change-NNN.md` por REQ + riesgos.

**Si el planner reporta que el problema es un bug** (no un cambio de requisito):

> Esto parece una corrección de error, no un cambio de requisito.
> Usa `sdd-classify-issue` o crea un `ERR-NNN.md` en el REQ afectado.
> Abortar `/change-req`.

---

## PASO 2 — Reviewer (subagente, contexto aislado)

Invocar al subagente `reviewer` pasándole ÚNICAMENTE el output del planner. NO pasarle contexto adicional ni INDEX.md crudos.

El reviewer debe buscar:

- Contradicciones entre Delta Specs propuestos.
- Dependencias circulares.
- REQs implícitamente afectados que el planner pasó por alto.
- Riesgos de regresión en REQs `needed_by`.

Devuelve: `APROBAR` | `APROBAR_CON_OBSERVACIONES` | `RECHAZAR` + observaciones.

---

## CHECKPOINT 1 — Humano (papel)

Presentar al usuario:

```
## Cambio propuesto
[Descripción en lenguaje natural]

## Impacto detectado
- REQs afectados: [lista]
- Entidades BD: [lista]
- Archivos de código: ~N archivos

## Delta Specs propuestos
[Resumen de uno por REQ — ADDED/MODIFIED/REMOVED]

## Veredicto del reviewer
[APROBAR / APROBAR_CON_OBSERVACIONES / RECHAZAR]
[Observaciones si las hay]

---
¿Procedo? [APROBAR / AJUSTAR / ABORTAR]
```

Esperar respuesta **explícita** del usuario. No continuar sin ella.

---

## PASO 3 — Aplicar cambios de papel (solo si el usuario aprobó)

### 3a. Crear rama git (si hay git)

Calcular NNN del nuevo change: listar `change-NNN.md` existentes en el REQ principal y tomar el siguiente número.

```bash
git checkout -b req/<REQ-ID>-change-<NNN>-<slug>
```

Multi-REQ: `req/<PRIMARY-REQ-ID>-change-<NNN>-multi-<slug>`

### 3b. Crear `change-NNN.md` en cada REQ afectado

Formato exacto:

```markdown
---
id: change-<NNN>
req_id: <REQ-ID>
title: <Título del cambio>
status: aprobado
created: <fecha-hoy>
supersedes: change-<NNN-anterior> (o "initial" si es el primero)
---

# change-<NNN> — <Título del cambio>

## Contexto

<Por qué se hace este cambio. Una o dos frases.>

## ADDED

<Lista de funcionalidades/comportamientos NUEVOS que no existían antes. Si no hay, omitir sección.>

- <ítem>

## MODIFIED

<Lista de funcionalidades/comportamientos que CAMBIAN respecto al estado anterior. Si no hay, omitir sección.>

- <ítem anterior> → <ítem nuevo>

## REMOVED

<Lista de funcionalidades/comportamientos que DESAPARECEN. Si no hay, omitir sección.>

- <ítem>

## Entidades de BD afectadas

<Tablas/modelos que cambian. Si no hay, omitir sección.>

## Criterios de aceptación

- <Criterio verificable 1>
- <Criterio verificable 2>
```

### 3c. Reescribir "Estado consolidado actual" en cada `INDEX.md` afectado

**NO** basta con cambiar `current_state`. Hay que reescribir la sección completa con el comportamiento **total** del REQ tras aplicar el delta — como si fuera la primera vez que alguien lee el REQ.

Actualizar también en el frontmatter:

```yaml
current_state: change-<NNN>
status: aprobado
```

### 3d. Marcar el `change-NNN.md` anterior como superseded

En el frontmatter del change anterior:

```yaml
status: superseded
superseded_by: change-<NNN-nuevo>
```

Al inicio del cuerpo, insertar banner:

```
> ⚠️ **ESTADO HISTÓRICO.** Superseded by change-<NNN-nuevo>. El estado vigente del REQ vive en `INDEX.md`. NO usar como fuente de verdad actual.
```

### 3e. Actualizar `ledger.md`

En `ledger.md` global y en el `ledger.md` de cada REQ afectado, añadir fila:

```
| <fecha-hoy> | <REQ-ID> | change-req | change-<NNN> | — | <Título del cambio> |
```

(columna Commit = `—` hasta después del commit)

### 3f. Commit de papel (si hay git)

```bash
git add requirements/ ledger.md
git commit -m "docs(<REQ-ID> change-<NNN>): <título del cambio>"
```

Actualizar columna Commit en ledger con `git rev-parse --short HEAD` y hacer segundo commit:

```bash
git add ledger.md
git commit -m "docs(<REQ-ID>): update ledger with commit hash"
```

---

## PASO 4 — Implementer (subagente, contexto aislado)

Invocar al subagente `implementer` pasándole ÚNICAMENTE:

- Los `change-NNN.md` aprobados (recién creados).
- Los `manifest.md` de los REQs afectados.

**NO pasarle** el plan original ni la discusión del reviewer.

El implementer debe:

1. Modificar código en archivos listados en los manifests + nuevos si aplica.
2. Generar y aplicar migración de BD si corresponde.
3. Actualizar `manifest.md` con archivos nuevos/cambiados.
4. Correr validación en 3 capas:
   - Tests automáticos (existentes + nuevos desde criterios de aceptación del change).
   - Smoke test en dev server local.
   - Generar checklist humano por REQ tocado.

**Si una capa de validación falla:** el implementer itera. NO presentar Checkpoint 2 hasta que pase.

---

## CHECKPOINT 2 — Humano (implementación)

Presentar al usuario:

```
## Implementación lista para revisión

### Archivos modificados
[Lista con tipo de cambio]

### Migraciones
[Lista — ADVERTIR si alguna es destructiva o irreversible]

### Validación
- Tests automáticos: ✅ N pasados / ❌ M fallaron
- Smoke test: ✅ / ❌
- Checklist humano:
  - [ ] [Caso de uso 1]
  - [ ] [Caso de uso 2]

---
Marca el checklist y aprueba para commit. [COMMIT / AJUSTAR / ABORTAR]
```

Esperar respuesta **explícita** del usuario.

---

## PASO 5 — Commit de código (si el usuario aprobó)

1. Actualizar `status` en `INDEX.md` de cada REQ: `implementado`.
2. Actualizar `status` en cada `change-NNN.md` aprobado: `implementado`.
3. (Si hay git):
   ```bash
   git add .
   git commit -m "feat(<REQ-ID> change-<NNN>): <título del cambio>"
   ```
4. Informar al usuario:
   - **Con git:** "Rama `req/<REQ-ID>-change-<NNN>-<slug>` lista con 2 commits. Próximo: `git push -u origin <branch>` + abrir PR. Tras mergear: `/cleanup-branches`."
   - **Sin git:** "Cambio aplicado en filesystem."

---

## CHECKLIST DE COMPLETITUD

Antes de reportar al usuario, verificar:

- [ ] Planner invocado y output recibido
- [ ] Reviewer invocado y veredicto recibido
- [ ] Checkpoint 1 presentado y usuario aprobó
- [ ] Rama git creada con naming correcto (si aplica)
- [ ] `change-NNN.md` creado en CADA REQ afectado
- [ ] `INDEX.md` "Estado consolidado actual" reescrito en CADA REQ afectado (no solo el puntero)
- [ ] `change` anterior marcado como `superseded` con banner ⚠️
- [ ] `ledger.md` global actualizado
- [ ] `ledger.md` por REQ actualizado
- [ ] Commit de papel creado (si aplica)
- [ ] Implementer invocado con los `change-NNN.md` + `manifest.md`
- [ ] Validación pasó (3 capas)
- [ ] Checkpoint 2 presentado y usuario aprobó
- [ ] `status: implementado` en INDEX y change
- [ ] Commit de código creado (si aplica)

Si algún ítem está pendiente, completarlo antes de continuar.

---

## Restricciones

- **NO hagas tú el análisis.** Para eso está el planner.
- **NO le des al reviewer contexto del planner.** Solo el output.
- **NO le des al implementer el plan original.** Solo los Delta Specs aprobados + manifests.
- **NO commitees sin Checkpoint 2 humano.** Regla dura.
- **NO modifiques `change-NNN.md` ya creados** salvo para marcarlos `superseded`. El contenido ADDED/MODIFIED/REMOVED es inmutable.
- **Si el flujo se interrumpe a mitad** (agente falla, usuario aborta), dejar los archivos en el estado que están — no intentar limpiar ni revertir a mano.
