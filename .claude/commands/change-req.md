---
description: EL flujo crítico de SDD. Analiza impacto, propone Delta Specs, espera aprobación, implementa. 2 checkpoints humanos. Cualquier cambio funcional pasa por aquí.
---

# /change-req — Modificar un requisito

## Tu rol

Recibir una descripción de cambio en lenguaje natural, analizar su impacto en los REQs, proponer los archivos a modificar, esperar aprobación, e implementar. El comando termina siempre con archivos escritos y commit creado (si hay git).

---

## PASO 0 — Setup de git

```bash
git rev-parse --git-dir 2>/dev/null
```

- **Si falla** → no hay git. Continuar sin ramas.
- **Si tiene éxito:**

```bash
git status --porcelain
```

Si hay cambios sin commitear, preguntar al usuario (stash / continuar / abortar).

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

Si no devuelve nada, usar `git branch --show-current`. Guardar como `<rama-base>`.

```bash
git checkout <rama-base>
```

> La rama se crea después del Checkpoint 1, cuando ya se conoce REQ principal + NNN.

---

## PASO 1 — Leer contexto del proyecto

1. Leer `ledger.md` global.
2. Leer el `INDEX.md` de cada REQ en `requirements/` — solo frontmatter + sección "Estado consolidado actual" + campo `dependencies`.
3. Para los REQs que parezcan relacionados con el cambio, leer también su `manifest.md`.

---

## PASO 2 — Analizar impacto

Determinar:

- **REQs directamente afectados:** tocan entidades, componentes o comportamientos que el cambio modifica.
- **REQs indirectos:** tienen `needed_by` apuntando a un REQ afectado.
- **Entidades de BD que cambian.**
- **Archivos de código a modificar** (de los `manifest.md` leídos).
- **Migraciones necesarias** (describir qué cambia en el schema, sin generar SQL todavía).

**Verificar si es bug o cambio de requisito:**

> "¿La promesa que le hicimos al usuario sigue válida?"

- Si sí y el código está mal → es un **bug**. Detener y decirle al usuario: _"Esto parece un bug, no un cambio de requisito. Descríbelo como error y usaré `sdd-classify-issue`."_
- Si no → es un **cambio de requisito**. Continuar.

---

## PASO 3 — Calcular NNN del change

Para el REQ principal afectado: listar `change-NNN.md` existentes en su carpeta y tomar el siguiente número disponible.

---

## CHECKPOINT 1 — Aprobación del plan (papel)

Presentar al usuario:

```
## Cambio propuesto: <título inferido>

### REQs afectados
- <REQ-ID>: <razón en una línea>

### Delta Specs propuestos

#### <REQ-ID> — change-<NNN>
ADDED:
- <ítem nuevo, si hay>

MODIFIED:
- <antes> → <después>

REMOVED:
- <ítem eliminado, si hay>

### Entidades BD
<Lista de tablas/modelos que cambian. "Ninguna" si no aplica.>

### Migraciones
<Descripción de qué cambia en el schema. "Ninguna" si no aplica.>
⚠️ DESTRUCTIVA si aplica (drop, alter con pérdida de datos).

### Archivos de código a tocar
- <path/archivo.ext> — <razón>

---
¿Procedo? [APROBAR / AJUSTAR / ABORTAR]
```

**Esperar respuesta explícita.** No continuar hasta recibir "APROBAR" o equivalente.

Si el usuario pide ajustes: corregir el plan y volver a presentar el checkpoint.
Si aborta: informar estado y detenerse.

---

## PASO 4 — Aplicar cambios de papel (tras APROBAR)

### 4a. Crear rama git (si hay git)

```bash
git checkout -b req/<REQ-ID>-change-<NNN>-<slug>
```

Multi-REQ: `req/<PRIMARY-REQ-ID>-change-<NNN>-multi-<slug>`

### 4b. Crear `change-NNN.md` en cada REQ afectado

```markdown
---
id: change-<NNN>
req_id: <REQ-ID>
title: <Título del cambio>
status: aprobado
created: <fecha-hoy>
supersedes: <change-NNN-anterior o "initial">
---

# change-<NNN> — <Título del cambio>

## Contexto

<Por qué se hace este cambio.>

## ADDED

<Omitir sección si no hay nada nuevo.>

- <ítem>

## MODIFIED

<Omitir sección si no hay modificaciones.>

- <antes> → <después>

## REMOVED

<Omitir sección si no se elimina nada.>

- <ítem>

## Entidades de BD afectadas

<Omitir si no hay cambios de BD.>

## Criterios de aceptación

- <Criterio verificable 1>
- <Criterio verificable 2>
```

### 4c. Reescribir "Estado consolidado actual" en cada `INDEX.md` afectado

Reescribir la sección completa con el comportamiento **total** del REQ tras aplicar el delta — como si fuera la primera vez que alguien lee el REQ. No basta con cambiar el puntero.

Actualizar frontmatter:

```yaml
current_state: change-<NNN>
status: aprobado
```

### 4d. Marcar change anterior como superseded

En el frontmatter del change anterior:

```yaml
status: superseded
superseded_by: change-<NNN>
```

Insertar banner al inicio del cuerpo:

```
> ⚠️ **ESTADO HISTÓRICO.** Superseded by change-<NNN>. El estado vigente vive en `INDEX.md`. NO usar como fuente de verdad.
```

### 4e. Actualizar ledgers

En `ledger.md` global y en el `ledger.md` de cada REQ afectado:

```
| <fecha-hoy> | <REQ-ID> | change-req | change-<NNN> | — | <Título del cambio> |
```

### 4f. Commit de papel (si hay git)

```bash
git add requirements/ ledger.md
git commit -m "docs(<REQ-ID> change-<NNN>): <título del cambio>"
```

Actualizar columna Commit en ledger con `git rev-parse --short HEAD` y segundo commit:

```bash
git add ledger.md
git commit -m "docs(<REQ-ID>): update ledger with commit hash"
```

---

## PASO 5 — Implementar el cambio

Con los `change-NNN.md` ya escritos como guía:

1. Modificar los archivos de código identificados en el Paso 2.
2. Generar y aplicar migración de BD si corresponde.
3. Actualizar `manifest.md` con archivos nuevos o modificados.
4. Ejecutar tests existentes. Si fallan, corregir antes de continuar.
5. Generar checklist de verificación manual basado en los criterios de aceptación del change.

---

## CHECKPOINT 2 — Aprobación de la implementación

Presentar al usuario:

```
## Implementación lista

### Archivos modificados
- <path> — <tipo de cambio>

### Migración
<Descripción o "Ninguna">
⚠️ Si es destructiva, advertir explícitamente.

### Tests
- Automáticos: ✅ N pasaron / ❌ M fallaron

### Checklist de verificación
- [ ] <Criterio de aceptación 1>
- [ ] <Criterio de aceptación 2>

---
¿Hago el commit? [COMMIT / AJUSTAR / ABORTAR]
```

**Esperar respuesta explícita.**

Si pide ajustes: corregir código y volver a presentar checkpoint 2.
Si aborta: dejar los archivos como están, informar estado.

---

## PASO 6 — Commit de código (tras COMMIT)

1. Actualizar `status: implementado` en el `INDEX.md` de cada REQ.
2. Actualizar `status: implementado` en cada `change-NNN.md` aprobado.

```bash
git add .
git commit -m "feat(<REQ-ID> change-<NNN>): <título del cambio>"
```

Informar al usuario:

- **Con git:** "Rama `req/<REQ-ID>-change-<NNN>-<slug>` con 2 commits. Próximo: `git push -u origin <branch>` + abrir PR. Tras mergear: `/cleanup-branches`."
- **Sin git:** "Cambio aplicado en filesystem."

---

## CHECKLIST DE COMPLETITUD

Verificar antes de reportar listo:

- [ ] Contexto leído: ledger + INDEX.md de REQs relevantes + manifests
- [ ] Impacto analizado y clasificado (cambio vs bug)
- [ ] Checkpoint 1 presentado y usuario aprobó
- [ ] Rama git creada con naming correcto (si aplica)
- [ ] `change-NNN.md` creado en CADA REQ afectado
- [ ] `INDEX.md` "Estado consolidado actual" reescrito (no solo el puntero)
- [ ] Change anterior marcado `superseded` con banner ⚠️
- [ ] `ledger.md` global y por REQ actualizados
- [ ] Commit de papel creado (si aplica)
- [ ] Código implementado
- [ ] Tests pasando
- [ ] `manifest.md` actualizado
- [ ] Checkpoint 2 presentado y usuario aprobó
- [ ] `status: implementado` en INDEX y change
- [ ] Commit de código creado (si aplica)

---

## Restricciones

- **NO commitees sin checkpoint humano explícito.** Regla dura.
- **NO modifiques `change-NNN.md` ya creados** salvo para marcarlos `superseded`. El contenido ADDED/MODIFIED/REMOVED es inmutable.
- **NO reescribas `initial.md`.** Jamás.
- **Si el flujo se interrumpe a mitad**, dejar los archivos como están — no intentar limpiar ni revertir a mano.
