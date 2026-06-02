# Workflow: `/rebuild-index REQ-XXX`

> **Operación de recuperación.** Reconstruye el `INDEX.md` de un REQ desde sus changes históricos.
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../concepts/principles.md`](../concepts/principles.md)
> - [`../templates/INDEX.md`](../templates/INDEX.md)
> - [`../concepts/context-loading.md`](../concepts/context-loading.md) (§5)

## Cuándo usarlo

Solo en escenarios excepcionales:

- El `INDEX.md` se corrompió o se borró por accidente.
- `/audit` detectó que el "Estado consolidado actual" del INDEX no refleja los changes aplicados.
- Tras un merge conflict mal resuelto.
- Tras un fallo de un agente a mitad de [`/change-req`](change-req.md) que dejó el INDEX a medias.

**NO es parte del flujo normal.** En el día a día, el INDEX se mantiene por [`/change-req`](change-req.md) en su paso 7.

## Coste

Esta operación carga **tier 3 entero del REQ**: lee `initial.md` + TODOS los `change-NNN.md` (vigentes y superseded) + el `archive/` si existe. Es lo más caro en contexto que puede hacer un agente sobre un REQ. Usarlo solo cuando hace falta.

## Pasos

1. **Cargar tier 3 del REQ:**
   - `initial.md`.
   - Todos los `change-NNN.md` en orden cronológico (ordenar por nombre, NNN ascendente).
   - Si existe `archive/`, leer `consolidated-*.md` para entender el estado al cierre de la era compactada.

2. **Reconstruir el estado paso a paso:**
   - Empezar con el comportamiento descrito en `initial.md`.
   - Aplicar mentalmente cada `change-NNN.md` en orden:
     - ADDED → añadir reglas.
     - MODIFIED → modificar reglas existentes.
     - REMOVED → quitar reglas.
   - El resultado final es el "Estado consolidado actual".

3. **Identificar el `current_state`:**
   - El último `change-NNN.md` con `status: implementado` (o `aprobado` si nada está implementado todavía).
   - Si todos los changes están `superseded`, el `current_state` es el último.
   - Si el REQ solo tiene `initial.md` → `current_state: initial`.

4. **Reconstruir el historial de versiones:**
   - Una fila por archivo (initial + changes) con fecha (del frontmatter `created`), tipo, autor, resumen.

5. **Identificar errores conocidos:**
   - Leer `errors/*.md` del REQ.
   - Generar la sección "Errores conocidos" con sus IDs y descripción corta.
   - Para errores donde este REQ es secundario (`reqs_afectados` lo incluye pero `req_principal` es otro), generar la sección "Errores relacionados en otros REQs".

6. **Generar el `INDEX.md` desde plantilla** ([`../templates/INDEX.md`](../templates/INDEX.md)) rellenando todo lo reconstruido.

7. **Antes de sobrescribir:** mostrar al usuario el `INDEX.md` reconstruido y el que existía (si existe), permitir comparar diff. Pedir aprobación.

8. **Sobrescribir el `INDEX.md`** del REQ tras aprobación.

9. **Registrar en `ledger.md`** del REQ y global tipo `rebuild-index`.

## Outputs

- `INDEX.md` reconstruido y validado por el usuario.
- Fila en ledgers.

## Errores comunes

- **No mostrar diff antes de sobrescribir.** Si el INDEX previo tenía notas manuales valiosas (ej. observaciones del owner), se perderían. Siempre permitir comparar.
- **Confundir `current_state`.** Si todos los changes están `superseded` por error → el INDEX queda apuntando a un change marcado como histórico. Resolver consultando al usuario: ¿cuál es realmente el estado vigente?
- **Reconstruir desde un archive incompleto.** Si el REQ fue compactado y el consolidated no es lo suficientemente detallado, la reconstrucción será imperfecta. En ese caso, leer también los changes en `archive/` directamente.
- **Olvidar errores.** Los `ERR-NNN.md` no afectan al "Estado consolidado actual" pero SÍ aparecen en el INDEX. No olvidarlos.

## Relación con `/audit`

`/audit` detecta INDEXes desactualizados y sugiere `/rebuild-index`. Pero también se puede ejecutar manualmente sin pasar por audit si el usuario detecta el problema directamente.
