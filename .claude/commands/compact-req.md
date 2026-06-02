---
description: Compacta los changes históricos de un REQ moviéndolos a archive/. Mantenimiento opcional cuando un REQ acumula muchos changes (>10).
---

# /compact-req REQ-XXX — Compactar changes históricos

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/workflows/compact-req.md` (manual completo, pasos 1-6)
3. `sdd/concepts/context-loading.md` (§4 — política de compactación)

## Tu rol

Reducir el número de `change-NNN.md` activos en la carpeta de un REQ moviendo los más antiguos a `archive/` y generando un consolidado del periodo. Esto NO modifica el estado vigente del REQ.

## Cuándo aplica

- Un REQ tiene > 10 changes históricos.
- La carpeta del REQ se ha vuelto difícil de navegar.
- Preparación para una fase nueva del producto.

**Si tiene < 10 changes, advertir al usuario que probablemente no vale la pena.**

## Flujo

Sigue los pasos 1-6 de `sdd/workflows/compact-req.md`:

1. **Cargar tier 3 del REQ.** Lee `initial.md` + todos los `change-NNN.md`.

2. **Proponer punto de corte.** Por defecto: dejar activos los últimos 3 changes + el vigente. Mostrar al usuario para que ajuste o apruebe.

3. **Generar `archive/consolidated-YYYY-MM-DD.md`** resumiendo qué cambió entre `initial.md` y el último change a compactar. Frontmatter:
   ```yaml
   ---
   id: REQ-AUTH-001
   compactado: YYYY-MM-DD
   incluye_desde: initial
   incluye_hasta: change-007
   reemplaza: [initial.md, change-001.md, ..., change-007.md]
   ---
   ```

4. **Mover los `change-NNN.md` compactados** a `archive/`. **NO borrar.**

5. **Actualizar el `INDEX.md`:**
   - Añadir nota: "Changes anteriores a `change-008` compactados en `archive/consolidated-YYYY-MM-DD.md`."
   - El "Estado consolidado actual" NO se modifica.
   - En la tabla "Historial de versiones", marcar las filas archivadas con icono 📦.

6. **Añadir fila tipo `compact`** en `ledger.md` del REQ y global.

## Modo de operación

1. Usuario dice "compacta REQ-AUTH-001".
2. Tú propones el punto de corte por defecto + muestras qué changes se moverían.
3. Usuario aprueba o ajusta el corte.
4. Ejecutas.

## Output ejemplo

```
Compactación REQ-AUTH-001:
- 7 changes movidos a archive/ (change-001 a change-007).
- Generado archive/consolidated-2026-09-01.md (resumen del periodo).
- INDEX.md actualizado con nota al archive.
- 3 changes activos restantes: change-008, change-009, change-010 (vigente).
- Fila añadida al ledger.
```

## Restricciones

- **NUNCA borres `change-NNN.md`.** Solo se mueven a `archive/`.
- **NUNCA compactes el change vigente.** Solo changes con `status: superseded`.
- **NO modifiques el "Estado consolidado actual" del INDEX.** El estado vigente no cambia, solo la organización de los archivos.
- **NO compactes si hay < 10 changes** salvo que el usuario insista.
