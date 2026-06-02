---
description: Detecta drift entre código y spec. Clasifica commits no documentados como cambio de requisito o corrección de error. Solo reporta — no modifica.
---

# /audit — Detección de drift

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/README.md`
3. `sdd/workflows/audit.md`

## Tu rol

Ejecutar auditoría de drift entre código y spec. Invocas al subagente `auditor` y presentas su reporte al usuario.

## Flujo

1. Invoca al subagente `auditor`.
2. Si el usuario pasó `--deep` como argumento, indícaselo al auditor — leerá tier 3.
3. Recibes del auditor: reporte estructurado con drift detectado y acciones propuestas.
4. Presenta el reporte al usuario agrupado por severidad:
   - 🔴 **Alta:** dependencias rotas, INDEX corrupto, inconsistencias estructurales.
   - 🟡 **Media:** drift de código (archivos huérfanos en commits feat/refactor).
   - 🟢 **Baja:** drift cosmético (archivos en commits chore/docs sin manifest update).

5. Para cada inconsistencia, ofrece la acción propuesta como **comando ejecutable**:
   - "¿Quieres ejecutar `/rebuild-index REQ-AUTH-002`?"
   - "¿Crear `ERR-NNN.md` en REQ-AUTH-001 para el commit `a1b2c3d`?"
   - "¿Invocar `/change-req` retroactivo para el commit `e4f5g6h`?"

6. Si el usuario aprueba alguna acción, ejecútala invocando el slash command correspondiente.

7. Al terminar, añadir fila tipo `audit` en `ledger.md` global con el resumen del resultado.

## Modo de operación

- Presenta el reporte de forma **escaneable**: severidad arriba, acciones ejecutables abajo, no párrafos largos.
- El usuario decide qué resolver de la lista. Tú lo ejecutas.
- No intentes resolver todo automáticamente — el drift puede tener significado intencional (ej. un dev tocó código sin manifest porque era una corrección urgente).

## Output ejemplo

```
🔴 Severidad alta (1):
- REQ-AUTH-002: INDEX desactualizado, current_state apunta a change-003 pero existe change-004 sin marcar.
  → Ejecutar `/rebuild-index REQ-AUTH-002`. [Sí / No]

🟡 Severidad media (3):
- `src/payments/webhook.ts` (commit `e4f5g6h` "feat: add stripe webhook") sin manifest.
  → Cambio de requisito candidato. Invocar `/change-req` retroactivo. [Sí / No]
- `src/auth/cookie.ts` (commit `a1b2c3d` "fix: handle null user") sin manifest.
  → Error candidato. Crear ERR-NNN.md en REQ-AUTH-001. [Sí / No]
- `src/utils/baz.ts` (commit `i7j8k9l` "refactor: simplify") sin manifest.
  → Ambiguo. ¿A qué REQ pertenece? [REQ-XXX / Nuevo REQ / Es código compartido]

🟢 Severidad baja (2):
- 2 archivos en commits `chore:` y `docs:` — sin acción requerida.

Total: 6 inconsistencias. Fila añadida al ledger global.
```

## Restricciones

- **NO modificas archivos** salvo la fila final del ledger.
- **NO ejecutas acciones propuestas sin aprobación humana.**
- **En casos ambiguos, pregunta al usuario** — no asumas.
