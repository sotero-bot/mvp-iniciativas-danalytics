---
name: sdd-guide
description: Carga las reglas duras y el mapa de SDD al inicio de sesión o cuando el usuario pregunta qué es este proyecto / cómo funciona / por dónde empezar. Onboarding-oriented. Skill informativa — no ejecuta nada.
---

# Skill: sdd-guide

## Carga obligatoria

1. `CLAUDE.md`
2. `sdd/README.md`

## Tu rol

Asegurar que cualquier sesión de un proyecto SDD tenga presente las reglas duras, los principios y el mapa de comandos disponibles. Útil para onboarding de devs nuevos o cuando alguien retoma un proyecto tras tiempo sin tocarlo.

## Cuándo dispararte

Triggers (descripciones del usuario o señales de la sesión):

- Primera interacción de una sesión nueva en un proyecto donde se detecta estructura SDD (presencia de `sdd/`, `CLAUDE.md` con marcador SDD, `requirements/` con REQs).
- "¿Qué es esto?"
- "¿Cómo funciona este proyecto?"
- "¿Por dónde empiezo?"
- "Soy nuevo en el proyecto"
- "Explícame la metodología"
- "Onboarding"
- "¿Qué puedo hacer aquí?"

## Output

```markdown
# Bienvenido a un proyecto SDD

**Spec-Driven Development**: el spec en Markdown es la única fuente de verdad. La IA propone, tú decides.

## Filosofía en 7 principios
1. La especificación es la única fuente de verdad. El código es subproducto.
2. Actualizar el spec ANTES que el código.
3. Cambios atómicos versionados, nunca destructivos. Historia navegable.
4. Los errores son aprendizaje institucional. Causa raíz + prompt detonante + acción preventiva.
5. La IA propone, el humano decide. Dos checkpoints (papel → implementación).
6. Trazabilidad bidireccional. Cada REQ sabe qué código implementa.
7. Cambio de requisito ≠ corrección de error.

## Reglas duras (siempre activas, no negociables)
1. `requirements/**/initial.md` jamás se modifica.
2. `change-*.md` solo se modifican para marcar superseded.
3. `INDEX.md` "Estado consolidado actual" es la única fuente de verdad del estado vigente.
4. `database/diagram.mmd` es autogenerado.
5. Cambio de requisito ≠ corrección de error.

## Comandos disponibles

| Comando | Para qué |
|---|---|
| `/init-project` | Bootstrap (si aún no se hizo) |
| `/new-req` | Crear requisito desde descripción natural |
| `/change-req` | EL flujo crítico: 3 agentes + 2 checkpoints |
| `/audit` | Detectar drift |
| `/rollback` | Revertir un change |
| `/sync-schema` | Regenerar diagrama ER |
| `/compact-req` | Compactar historia |
| `/rebuild-index` | Recuperar INDEX |

## Skills que se autoactivan

| Skill | Cuándo |
|---|---|
| `sdd-status` | Preguntas sobre estado |
| `sdd-classify-issue` | Reporte de bug |
| `sdd-guide` | (esta) — onboarding |

## Detalle de cada cosa

- `sdd/README.md` — Índice maestro de la metodología.
- `sdd/concepts/principles.md` — Los 7 principios extendidos.
- `sdd/workflows/change-req.md` — El flujo crítico.
- `sdd/concepts/error-management.md` — Cómo gestionar errores.
- `requisitos.md` — Versión monolítica completa (deep dive).

## Próximo paso recomendado

[Adaptar según contexto:]
- Si es proyecto greenfield sin REQs: "Ejecuta `/init-project` para bootstrapear."
- Si ya hay REQs: "Pregunta `¿cómo va el proyecto?` para activar la skill `sdd-status` y ver el estado actual."
- Si quieres hacer un cambio: "Tipea `/change-req` seguido de tu descripción en lenguaje natural."
```

## Restricciones

- **NO ejecutas nada.** Solo informas.
- **Sé conciso.** Resumen útil, no lección completa. Si el usuario quiere deep dive, derivar a `sdd/README.md` o `requisitos.md`.
- **Adapta el output al contexto.** Si detectas que el proyecto aún no se ha bootstrapeado (no hay `docs/` ni `requirements/`), enfatiza `/init-project`. Si ya está operativo, enfatiza los comandos del día a día.
- **No dispares si ya disparaste en esta sesión.** Solo en la primera interacción o cuando el usuario pida explícitamente.
