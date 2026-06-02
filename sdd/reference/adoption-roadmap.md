# Roadmap de adopción incremental

> Cómo introducir esta metodología a un proyecto existente (brownfield).
>
> Para proyectos nuevos (greenfield), simplemente seguir [`/init-project`](../workflows/init-project.md) desde el inicio.

## Premisa

Brownfield = proyecto con código en producción, requisitos no documentados, sin estructura SDD previa. No se puede pausar el desarrollo para "documentar todo desde cero": hay que hacerlo incrementalmente sin frenar al equipo.

## Plan en 4 semanas

### Semana 1 — Documentación base

**Objetivo:** rellenar `docs/` para que la IA tenga base.

- Crear la carpeta `docs/` con las 4 plantillas vacías (ver [`../templates/docs/`](../templates/docs/)).
- Reunir al equipo (o al PO) para rellenar:
  - `vision.md`: qué problema resuelve, objetivos actuales.
  - `tech-stack.md`: tecnologías ya en uso. Levantar la mano si hay un stack único que la IA no conoce → registrar.
  - `personas.md`: usuarios reales del producto a día de hoy.
  - `constraints.md`: compliance ya aplicado + restricciones técnicas conocidas.

**Producto final de la semana:** `docs/` completo. Sin esto, no se puede continuar.

### Semana 2 — REQs retroactivos

**Objetivo:** crear los REQs que cubren la funcionalidad ya existente, en status `current`.

**Opción A — Automática (recomendada):** ejecutar `/reverse-engineer`.

La IA explora el código, identifica dominios funcionales y genera automáticamente los 3 archivos SDD por dominio (`initial.md`, `INDEX.md`, `manifest.md`). Antes de escribir nada, agrupa las dudas que no puede inferir y las pregunta en un solo bloque. Al terminar entrega un reporte con los REQs generados y advertencias de cobertura ambigua.

Después de ejecutarlo:
- Revisar cada `initial.md` y corregir imprecisiones (la IA no conoce el contexto de negocio).
- Completar secciones que quedaron vacías en los `manifest.md`.
- Identificar dependencias entre REQs y rellenar `dependencies.needs` / `needed_by`.

**Opción B — Manual (si el proyecto es muy complejo o la IA no puede explorarlo bien):** para cada feature significativa del producto, crear una carpeta de REQ con [`/new-req`](../workflows/new-req.md):
  - `initial.md` describiendo el comportamiento ACTUAL de la feature.
  - `INDEX.md` con `status: current`.
  - `manifest.md` rellenado con los archivos que actualmente implementan la feature.

En ambos casos: **NO crear `change-NNN.md` retroactivos.** El historial de cambios previos a la adopción se pierde — es aceptable. Solo se versionan cambios DESDE la adopción.

**Producto final de la semana:** estado actual del producto cristalizado en REQs `current`.

### Semana 3 — Configuración técnica

**Objetivo:** dejar todo el aparato técnico listo.

- Crear `requirements/` (ya existe si se hizo semana 2).
- Configurar `database/`:
  - `schema.sql` o `schema.prisma` ya existe en el proyecto → vincular.
  - Configurar GitHub Action del diagrama ER (ver [`github-actions.md`](github-actions.md)).
- Crear `brand/` con los assets actuales.
- Crear `decisions/` y empezar a documentar ADRs **retroactivos** para las decisiones técnicas más importantes ya tomadas.
- Crear `ledger.md` global (con cabecera, sin filas históricas — el ledger empieza en este momento).
- Crear `CLAUDE.md` con reglas duras + resumen de stack.
- Copiar `sdd/` (esta metodología) al repo.
- Configurar `.claude/agents/` y `.claude/commands/`.
- **Ejecutar primer [`/audit`](../workflows/audit.md)** para detectar drift inicial entre código y manifests. Resolver las inconsistencias detectadas (faltarán muchos archivos en manifests — añadirlos).

**Producto final de la semana:** infraestructura SDD completa, primer audit limpio.

### Semana 4 en adelante — Operación normal

**Objetivo:** todo cambio nuevo pasa por la metodología.

- Todo cambio funcional nuevo → [`/change-req`](../workflows/change-req.md).
- Cualquier bug → `ERR-NNN.md` en el REQ afectado.
- Cualquier decisión técnica nueva → ADR.
- Periódicamente (mensual o trimestral): [`/audit`](../workflows/audit.md), [`/status`](../workflows/status.md).
- Los errores existentes en el backlog se documentan **retroactivamente con `ERR-NNN.md` solo si son recurrentes o instructivos**. No documentar cada bug histórico — sería trabajo perdido.

## Activación de PR review (opcional, futuro)

La activación del flujo de PR review (cuando el equipo lo decida) consiste solo en:
1. Habilitar branch protection en `main` exigiendo aprobación.
2. Definir quién aprueba (cualquier dev, owner del REQ, tech lead — el equipo decide).
3. Mantener las convenciones de commits (ver [`commit-conventions.md`](commit-conventions.md)).

**El resto de la metodología no cambia.** Los checkpoints humanos de `/change-req` siguen siendo los mismos, ahora simplemente se materializan como aprobaciones de PR.

## Errores comunes en adopción brownfield

- **Intentar documentar todo el historial.** Esfuerzo desproporcionado. Solo cristalizar el estado ACTUAL.
- **Crear REQs demasiado granulares.** Para brownfield, REQs gruesos (una feature completa = un REQ) son más prácticos que muchos REQs atómicos. Se pueden refinar después.
- **Saltarse el primer audit.** El primer audit casi siempre detecta muchos archivos huérfanos. Es esperado. Resolver paciencia, no ignorar.
- **Cargar agentes sin haber hecho el setup.** Los agentes (planner, reviewer, implementer) necesitan que `docs/`, `requirements/` y `manifests` ya existan. No invocarlos hasta semana 3.

## Métrica de éxito de la adopción

A los 2 meses de adoptar:
- 100% de cambios funcionales nuevos pasan por `/change-req`.
- Todos los REQs `current` tienen `manifest.md` no vacío.
- `/audit` detecta < 5% de archivos huérfanos.
- Hay al menos 1–2 ADRs documentados.

Si no se llega a estos números, revisar qué fricciones hay (puede ser que un comando no esté bien configurado, o que un dev se salte el flujo). No es problema de la metodología en sí.
