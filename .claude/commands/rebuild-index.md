---
description: Reconstruye el INDEX.md de un REQ desde sus changes históricos. Operación de RECUPERACIÓN — solo cuando el INDEX está corrupto o desactualizado.
---

# /rebuild-index REQ-XXX — Reconstruir INDEX

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/workflows/rebuild-index.md` (manual completo, pasos 1-9)
3. `sdd/templates/INDEX.md`
4. `sdd/concepts/context-loading.md` (§5)

## Tu rol

Reconstruir el `INDEX.md` de un REQ leyendo `initial.md` + todos los `change-NNN.md` en orden y aplicando deltas. Esto es la **operación más cara en contexto** que se puede hacer sobre un REQ (carga tier 3 entero). Solo cuando es necesario.

## Cuándo se usa

- El `INDEX.md` se corrompió o se borró por accidente.
- `/audit` detectó que el "Estado consolidado actual" no refleja los changes aplicados.
- Merge conflict mal resuelto.
- Un agente falló a mitad de `/change-req` y el INDEX quedó a medias.

**NO en flujo normal.** En el día a día, el INDEX se mantiene en el paso 7 de `/change-req`.

## Flujo

Sigue los pasos 1-9 de `sdd/workflows/rebuild-index.md`:

1. **Cargar tier 3 del REQ:**
   - `initial.md`.
   - Todos los `change-NNN.md` en orden cronológico (ordenar por NNN ascendente).
   - Si existe `archive/`, leer `consolidated-*.md` para entender el estado al cierre de la era compactada.

2. **Reconstruir el estado paso a paso:**
   - Empezar con el comportamiento de `initial.md`.
   - Aplicar cada `change-NNN.md` mentalmente en orden:
     - ADDED → añadir.
     - MODIFIED → modificar.
     - REMOVED → quitar.
   - El resultado final es el "Estado consolidado actual".

3. **Identificar `current_state`:**
   - El último `change-NNN.md` con `status: implementado` (o `aprobado` si nada está implementado).
   - Si todos los changes están `superseded`, el `current_state` es el último.
   - Si solo hay `initial.md` → `current_state: initial`.

4. **Reconstruir historial de versiones** (tabla cronológica con fila por archivo).

5. **Identificar errores conocidos:**
   - Listar `ERR-NNN.md` de `errors/` del REQ.
   - Generar sección "Errores conocidos" con IDs.
   - Para errores donde este REQ es secundario (no `req_principal`), generar "Errores relacionados en otros REQs".

6. **Generar INDEX nuevo** desde `sdd/templates/INDEX.md`.

7. **CHECKPOINT humano (OBLIGATORIO):** mostrar al usuario el INDEX reconstruido **junto al actual** (si existe), permitiendo comparar diff. Pedir aprobación.

8. **Sobrescribir el `INDEX.md`** tras aprobación.

9. **Registrar en `ledger.md`** del REQ y global tipo `rebuild-index`.

## Modo de operación

Operación de recuperación. El usuario dice "el INDEX de REQ-X está roto" o similar.

1. Cargas tier 3 entero del REQ (advertencia: caro en contexto).
2. Reconstruyes y muestras diff vs INDEX actual.
3. Esperas aprobación.
4. Sobrescribes.

## Restricciones

- **NUNCA sobrescribas sin mostrar diff** al usuario y obtener aprobación.
- **Si el INDEX actual tiene notas manuales valiosas** (observaciones del owner, contexto adicional), preservarlas o señalarlas al usuario para que decida.
- **Si todos los changes están `superseded`**, hay inconsistencia previa — consultar al usuario qué es realmente el estado vigente.
- **Si la reconstrucción desde un archive incompleto es imprecisa**, advertir y leer también los `change-NNN.md` del `archive/` directamente.
