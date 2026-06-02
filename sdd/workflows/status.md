# Workflow: `/status`

> Genera un reporte del estado actual del proyecto.
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)

## Propósito

Vista de pájaro del proyecto: qué REQs hay, en qué estado están, qué errores abiertos existen, qué hay por hacer.

Útil al volver al proyecto tras una pausa, al hacer una sync semanal del equipo, o como input rápido para una reunión.

## Pasos

1. **Tier 0 + 1.** Cargar `ledger.md` global + `INDEX.md` de TODOS los REQs.

2. **Calcular agregados:**
   - Total de REQs por estado: `draft`, `aprobado`, `implementado`, `deprecado`.
   - REQs por dominio (auth, payments, etc.).

3. **Errores abiertos.** Listar `ERR-NNN.md` con `estado: detectado` o `en_investigacion` en todos los REQs. Mencionar a qué REQ pertenecen.

4. **Actividad reciente.** Últimas 10 filas del `ledger.md` global.

5. **Drift candidatos.**
   - REQs con `status: implementado` pero `manifest.md` vacío.
   - REQs con dependencias rotas (apuntan a REQs deprecados o inexistentes).
   - REQs cuyo `INDEX.md` no se ha actualizado desde hace > 30 días pero su carpeta tiene commits recientes en archivos del manifest.

6. **Generar reporte:**

   ```markdown
   # Estado del proyecto — YYYY-MM-DD

   ## Resumen
   - Total REQs: 24
     - draft: 3
     - aprobado: 5
     - implementado: 14
     - deprecado: 2

   ## Por dominio
   - auth: 6 REQs (5 implementados, 1 draft)
   - payments: 8 REQs (...)
   - onboarding: 4 REQs (...)
   - notifications: 6 REQs (...)

   ## Errores abiertos (3)
   - ERR-003 (REQ-PAY-001) — detectado — webhook duplicado
   - ERR-007 (REQ-AUTH-002) — en_investigacion — token MFA inconsistente
   - ERR-012 (REQ-NOTIF-001) — detectado — email no llega en GMail

   ## Actividad reciente (últimos 10 cambios)
   <Pegar últimas filas del ledger global>

   ## Posibles drift (revisar)
   - REQ-PAY-003 — status implementado pero manifest vacío
   - REQ-AUTH-001 → REQ-AUTH-004 (deprecado): dependencia rota
   - REQ-NOTIF-002 — INDEX no actualizado desde 2026-04-12 pero hay commits en archivos del manifest
   ```

## Outputs

- Reporte markdown impreso en pantalla (no se guarda como archivo por defecto — es información volátil).
- Si el usuario quiere persistirlo: ofrecer guardarlo en `reports/status-YYYY-MM-DD.md` (carpeta opcional, no parte de la metodología obligatoria).

## Sugerencias accionables

Al final del reporte, la IA puede sugerir acciones:

- Si hay drift detectado → "Ejecutar `/audit` para investigar."
- Si hay errores `detectado` sin movimiento desde hace > 1 semana → "Revisar ERR-003, ERR-012 (sin actividad reciente)."
- Si hay REQs `draft` desde hace > 30 días → "Promover o descartar: REQ-AUTH-005, REQ-PAY-002."
- Si hay REQs `aprobado` no implementados desde hace > 60 días → "¿Sigue en plan?".

## Errores comunes

- **Reporte demasiado detallado.** El propósito es vista de pájaro. Si el usuario quiere detalle de un REQ específico → derivar a leer su `INDEX.md`.
- **No incluir drift.** Sin esta sección, el `/status` pierde su capa más útil. Siempre incluir.
