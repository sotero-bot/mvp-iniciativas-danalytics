# Workflow: `/rollback REQ-XXX`

> Revierte un cambio aplicado a un REQ.
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../concepts/principles.md`](../concepts/principles.md)
> - [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md) (para migración inversa)

## Cuándo usarlo

- Un cambio en producción rompió algo y queremos volver al estado anterior.
- Una decisión técnica se revierte y queremos deshacer el código + spec asociado.
- Como herramienta de emergencia. **No** sustituye al flujo normal de `/change-req` para evolucionar el spec.

## Pasos

1. **Mostrar historial.** La IA lee el `INDEX.md` del REQ y muestra al usuario las versiones disponibles para revertir:
   ```
   REQ-AUTH-001 — Login con Google

   Versión vigente: change-002 (sesión a 30 min)
   Versiones anteriores:
     - change-001 (recordar dispositivo)
     - initial (sesión a 60 min)
   ```

2. **Usuario elige `version_objetivo`** (ej. `change-001` para revertir solo el último cambio, o `initial` para revertir todo).

3. **Generar plan de rollback:**
   - Identificar commits asociados al cambio (cruzando `ledger.md` del REQ con `git log` y los commit messages que mencionan el REQ + change ID).
   - Generar comando(s) de migración `down` correspondiente(s) al sistema de migraciones del proyecto (ver [`../reference/migrations-by-framework.md`](../reference/migrations-by-framework.md)). Ejemplo Prisma: `prisma migrate resolve --rolled-back <migration-name>`.
   - Mostrar plan:
     ```
     Plan de rollback REQ-AUTH-001 → change-001:

     Commits a revertir:
       - a1b2c3d "feat(REQ-AUTH-001 change-002): sesión a 30 min"
       - e4f5g6h "docs(REQ-AUTH-001): añadir change-002"

     Migración inversa:
       - prisma migrate resolve --rolled-back 0007_session_ttl_30min

     Cambios en el INDEX:
       - current_state: change-002 → change-001
       - status: implementado (sigue, si change-001 estaba implementado)
       - Reescribir "Estado consolidado actual" con el estado de change-001
     ```

4. **CHECKPOINT humano:** el usuario revisa el plan y aprueba.

5. **Ejecutar:**
   a. **(Si hay git)** Crear rama de rollback:
      ```bash
      git checkout -b rollback/<REQ-ID>-to-<version-objetivo>
      ```
      Ej: `rollback/REQ-AUTH-001-to-change-001`. Ver [`../reference/commit-conventions.md`](../reference/commit-conventions.md).
   b. `git revert <commits>` (en el orden inverso a su creación).
   c. Ejecutar migración inversa con el comando del paso 3.
   d. Actualizar `INDEX.md`:
      - `current_state` → versión objetivo.
      - Reescribir "Estado consolidado actual" reflejando el estado de la versión objetivo.
      - Añadir nota al final del INDEX: "Rollback aplicado el YYYY-MM-DD desde `change-NNN` por motivo X. Ver `change-NNN.md` para detalles del cambio revertido."
   e. **NO borrar** el `change-NNN.md` revertido. Queda como historia. Marcarlo con un nuevo banner:
      ```
      > ⚠️ **REVERTIDO.** Este change fue aplicado y posteriormente revertido el YYYY-MM-DD. Ver el INDEX.md para el estado actual.
      ```
   f. Añadir fila en `ledger.md` global tipo `rollback` y en `ledger.md` del REQ.
   g. **(Si hay git)** Commit del rollback:
      ```
      git add .
      git commit -m "revert(REQ-<ID>): rollback de change-<NNN> a <objetivo>"
      ```
   h. Si el rollback se hizo por un bug en producción → crear `ERR-NNN.md` con la causa raíz que motivó el rollback. Categoría suele ser `regresion`.

## Tras el rollback (si hay git)

- La rama `rollback/<REQ-ID>-to-<objetivo>` queda en local con los commits del revert + actualización de INDEX.
- Próximo paso: `git push -u origin <branch>` y abrir PR de emergencia.
- Tras mergear, ejecutar [`/cleanup-branches`](cleanup-branches.md).

## Outputs

- Commits revertidos.
- Migración inversa aplicada.
- `INDEX.md` actualizado.
- `change-NNN.md` revertido marcado con banner.
- Posible `ERR-NNN.md` creado.
- Filas en ledgers.

## Casos especiales

- **Datos perdidos en migración inversa.** Algunas migraciones no son reversibles sin pérdida de datos (ej. drop de columna con info). Antes del checkpoint humano, advertir explícitamente: "Esta migración no es reversible sin pérdida de datos. Considera respaldo previo."

- **Rollback de varios changes a la vez.** Si la versión objetivo está varios changes atrás (ej. revertir desde `change-005` a `change-002`), revertir uno a uno en orden inverso. NO saltar.

- **El REQ ya fue tocado por otros REQs después.** Si REQ-AUTH-001 `change-002` afectó a REQ-AUTH-002, revertir REQ-AUTH-001 sin tocar REQ-AUTH-002 puede dejar inconsistencias. El planner (de `/change-req`) habría detectado esto; en `/rollback` hay que hacerlo manualmente: advertir al usuario de REQs `needed_by` y preguntar si también revertirlos.

## Errores comunes

- **Olvidar la migración inversa.** El código vuelve atrás pero la BD queda en estado nuevo → app no arranca. Siempre incluir migración en el plan.
- **Borrar el change revertido.** No. Queda como historia.
- **No crear el ERR.** Si el rollback fue por un bug, sin un `ERR-NNN.md` se pierde la lección. Recordatorio obligatorio en el paso 5f.
