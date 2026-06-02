---
name: sdd-status
description: Reporta el estado actual del proyecto SDD — total REQs por estado, errores abiertos, drift candidato, actividad reciente. Dispárate cuando el usuario pregunte por estado, progreso, qué falta, qué hay pendiente, vista general del proyecto, cuántos REQs hay, o errores abiertos. Skill read-only — no ejecuta cambios.
---

# Skill: sdd-status

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/workflows/status.md`

## Tu rol

Generar un reporte conciso del estado actual del proyecto SDD. Solo lectura — no modificas nada.

## Pasos

Sigue los pasos 1-6 de `sdd/workflows/status.md`:

1. **Tier 0 + 1.** Cargar `ledger.md` global + `INDEX.md` de todos los REQs.
2. **Calcular agregados:** REQs por estado, por dominio.
3. **Errores abiertos:** listar `ERR-NNN.md` con estado `detectado` o `en_investigacion`.
4. **Actividad reciente:** últimas 10 filas del ledger global.
5. **Drift candidatos:** REQs `implementado` con `manifest.md` vacío, dependencias rotas, INDEX no actualizado.
6. **Generar reporte estructurado.**

## Output (al main session)

```markdown
# Estado del proyecto — YYYY-MM-DD

## Resumen
- Total REQs: N
  - draft: N
  - aprobado: N
  - implementado: N
  - deprecado: N

## Por dominio
- auth: N REQs (X implementados, Y drafts)
- payments: N REQs (...)
...

## Errores abiertos (N)
- ERR-XXX (REQ-YYY) — [estado] — [descripción corta]
...

## Actividad reciente
[Últimas 10 filas del ledger global]

## Posibles drift (revisar)
- REQ-XXX — [razón]
...

## Sugerencias accionables
- /audit si hay drift detectado
- Revisar errores estancados (X días sin movimiento)
- Promover o descartar drafts viejos
```

## Cuándo dispararte

Triggers de la skill (descripciones del usuario que indican intención de saber el estado):

- "¿Cómo va el proyecto?"
- "¿Qué hay pendiente?"
- "¿En qué estamos?"
- "Vista general"
- "Estado / status / progreso"
- "¿Cuántos REQs hay?"
- "¿Hay errores abiertos?"
- "¿Qué falta?"
- "Resumen del proyecto"
- Cualquier pregunta abierta sobre el estado del producto/proyecto.

## Restricciones

- **Modo READ-ONLY.** No modificas archivos.
- **No persistes el reporte.** Es info volátil — solo se imprime en pantalla. Si el usuario lo quiere guardar, ofrécelo como acción separada.
- **No invoques otros workflows automáticamente.** Solo sugieres. El usuario decide.
- **Reporte conciso.** Vista de pájaro, no detalle por REQ. Si quieren detalle, derivar a leer el INDEX específico.
