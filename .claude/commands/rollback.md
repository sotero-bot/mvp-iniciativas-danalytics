---
description: Revierte un change aplicado. Operación destructiva — checkpoint humano OBLIGATORIO antes de ejecutar.
---

# /rollback REQ-XXX — Revertir un cambio

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/README.md`
3. `sdd/workflows/rollback.md` (manual completo, pasos 1-5)
4. `sdd/reference/migrations-by-framework.md` (para migración inversa)

## Tu rol

Revertir el último (o N últimos) change(s) de un REQ. Esto implica:

- `git revert` de commits asociados.
- Ejecutar migración inversa.
- Actualizar `INDEX.md` apuntando a la versión objetivo.
- Marcar el `change-NNN.md` revertido con banner ⚠️ REVERTIDO.
- Si el rollback fue por bug en producción → crear `ERR-NNN.md`.

## Flujo

### 1. Mostrar historial

Lee el `INDEX.md` del REQ. Muestra al usuario las versiones a las que puede revertir:

```
REQ-AUTH-001 — Login con Google

Versión vigente: change-002 (sesión a 30 min)
Versiones anteriores:
  - change-001 (recordar dispositivo) — 2026-06-08
  - initial (sesión a 60 min) — 2026-06-01
```

### 2. Usuario elige versión objetivo

### 3. Generar plan de rollback

- Identificar commits asociados al/los change(s) a revertir cruzando `ledger.md` del REQ con `git log` (buscar commit messages que mencionen el REQ + change).
- Generar comando de migración inversa según `sdd/reference/migrations-by-framework.md` y el sistema de migraciones del proyecto (en `docs/tech-stack.md`).
- Identificar REQs `needed_by` que también podrían quedar inconsistentes.

### 4. Presentar plan al usuario y AVISAR si hay riesgo

```
## Plan de rollback REQ-AUTH-001 → change-001

### Commits a revertir (en orden inverso)
- `a1b2c3d` "feat(REQ-AUTH-001 change-002): sesión a 30 min"
- `e4f5g6h` "docs(REQ-AUTH-001): añadir change-002"

### Migración inversa
- `npx prisma migrate resolve --rolled-back 0007_session_ttl_30min`

### REQs dependientes que podrían quedar inconsistentes
- REQ-AUTH-002 (depende de la duración de sesión modificada en change-002).
  Sugerencia: revisar tras rollback, posible /change-req también para REQ-AUTH-002.

### ⚠️ Aviso de pérdida de datos
[Solo si la migración inversa pierde datos. Si no, omitir esta sección.]

---
¿Procedo con el rollback? [SÍ / NO / AJUSTAR PLAN]
```

### 5. Si SÍ — ejecutar

a. **(Si hay git)** Crear rama: `git checkout -b rollback/<REQ-ID>-to-<version-objetivo>`.
b. `git revert <commits>` (orden inverso a creación).
c. Ejecutar migración inversa.
d. Actualizar `INDEX.md`:

- `current_state` → versión objetivo.
- **Reescribir "Estado consolidado actual"** reflejando el estado de la versión objetivo.
- Añadir nota: "Rollback aplicado YYYY-MM-DD desde change-NNN por motivo X. Ver `change-NNN.md` para detalles del cambio revertido."
  e. **NO borrar** el `change-NNN.md` revertido. Marcarlo con un nuevo banner al inicio del cuerpo:

```
> ⚠️ **REVERTIDO.** Este change fue aplicado y posteriormente revertido el YYYY-MM-DD. Ver INDEX.md para el estado actual.
```

f. Añadir fila tipo `rollback` en `ledger.md` global y en `ledger.md` del REQ.
g. **(Si hay git)** Commit: `git commit -m "revert(REQ-<ID>): rollback de change-<NNN> a <objetivo>"`. Próximo: push + PR de emergencia. Tras mergear: `/cleanup-branches`.

### 6. Si el rollback fue por bug en producción

Ofrecer al usuario:

> El rollback se hizo porque el cambio rompía algo en producción. ¿Quieres que cree un `ERR-NNN.md` ahora con la causa raíz? [Sí / No / Después]

Si sí, derivar a la skill `sdd-classify-issue` o crear el ERR directamente con categoría `regresion`.

## Modo de operación

Operación de **emergencia**. El usuario dice algo como _"revierte el último cambio de auth"_:

1. Muestras el plan completo **antes de tocar nada**.
2. AVISO explícito si hay pérdida de datos.
3. Esperas aprobación explícita.
4. Ejecutas todo en orden.
5. Si fue por bug, ofreces crear ERR inmediatamente.

## Restricciones

- **NUNCA ejecutes el rollback sin aprobación humana explícita.** Es regla dura.
- **NO borres el `change-NNN.md` revertido.** Queda como historia.
- **Si la migración no es reversible sin pérdida**, el aviso explícito es obligatorio.
- **Si revertir afecta a REQs `needed_by`**, advertirlo en el plan. No ejecutar a ciegas.
