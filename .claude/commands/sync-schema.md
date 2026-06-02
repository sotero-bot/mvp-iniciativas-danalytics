---
description: Regenera el diagrama ER (database/diagram.mmd) localmente desde el schema fuente. Útil cuando no quieres esperar al CI.
---

# /sync-schema — Regenerar diagrama ER

## Carga obligatoria

1. `sdd/workflows/sync-schema.md`
2. `sdd/reference/github-actions.md` (versión CI del mismo proceso)
3. `docs/tech-stack.md` (para identificar el generador correcto)

## Tu rol

Regenerar `database/diagram.mmd` localmente sin esperar al GitHub Action.

## Flujo

1. Lee `docs/tech-stack.md` y detecta el generador correcto:
   - **Prisma:** `npx prisma generate` (asumiendo `prisma-erd-generator` configurado en `schema.prisma`).
   - **SQL plano:** `python scripts/sql_to_mermaid.py` (asumiendo el script de `sdd/reference/github-actions.md` instalado en `scripts/`).
   - **Django:** `python manage.py graph_models -a -o database/diagram.png` con `django-extensions`.
   - **Otro:** según lo que `tech-stack.md` indique. Si está mal documentado, preguntar al usuario.

2. Ejecutar el comando.

3. Verificar que `database/diagram.mmd` se actualizó (comparar con versión anterior si la había).

4. Reportar:
   - Si se actualizó: "Diagrama regenerado. Cambios: [breve diff]."
   - Si no había cambios en el schema: "Schema sin cambios desde la última generación. No se actualizó nada."

## Modo de operación

Operación rápida, sin checkpoints. Solo informa el resultado.

Si la herramienta del generador no está instalada (ej. `prisma-erd-generator` falta), advierte al usuario y sugiere instalarla (referenciando `sdd/reference/github-actions.md`).

## Restricciones

- **NO edites `database/diagram.mmd` manualmente** (regla dura #4). Solo ejecutas el generador.
- **Si el generador falla** (script roto, dependencia faltante), reporta el error sin intentar workarounds que generen el diagrama "a mano".
