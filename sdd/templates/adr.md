# Plantilla: ADR (Architecture Decision Record)

> Vive en `<project-root>/decisions/ADR-NNN-<slug>.md`.
>
> Formato: **MADR ligero** + link explícito a los REQs afectados.
>
> Se crea cuando se toma una decisión técnica no trivial: elección de framework, ORM, estrategia de cache, modelo de auth, etc.

## Plantilla

```markdown
---
id: ADR-001
title: Usar Prisma como ORM
status: aceptado                         # propuesto | aceptado | superseded | deprecado
date: 2026-06-01
deciders: [sotero]
related_reqs: [REQ-AUTH-001, REQ-PAY-001]
superseded_by: null                      # ADR-NNN si esta decisión es reemplazada
---

# ADR-001 — Usar Prisma como ORM

## Contexto
Necesitamos un ORM que soporte migraciones, sea compatible con Next.js y permita
generar tipos automáticamente.

## Decisión
Adoptar Prisma como ORM principal.

## Consecuencias
**Positivas:**
- Migraciones declarativas.
- Tipos generados automáticamente.
- Buen soporte para PostgreSQL.

**Negativas:**
- Dependencia de un único proveedor.
- Curva de aprendizaje del schema.prisma.

## Alternativas consideradas
- **Drizzle**: más liviano pero ecosistema más joven.
- **TypeORM**: maduro pero ergonomía inferior.

## Requisitos afectados
- [[REQ-AUTH-001]] — define entidades users, sessions, oauth_accounts.
- [[REQ-PAY-001]] — define entidades orders, payments.
```

## Semántica

| Campo | Significado |
|---|---|
| `id` | `ADR-NNN`. Numeración **global** del proyecto. |
| `title` | Título corto, imperativo ("Usar X", "Adoptar Y", "Reemplazar Z por W"). |
| `status` | `propuesto` (en discusión), `aceptado` (vigente), `superseded` (reemplazado por otro ADR), `deprecado` (ya no aplica, nada lo reemplaza). |
| `date` | Fecha ISO de la decisión. |
| `deciders` | Quién(es) la tomaron. |
| `related_reqs` | REQs motivados o afectados por esta decisión. |
| `superseded_by` | Si este ADR fue reemplazado, ID del ADR sucesor. |

## Secciones del cuerpo

- **Contexto** — Situación que llevó a tomar la decisión. Por qué hubo que decidir.
- **Decisión** — Qué se decidió. Una frase directa.
- **Consecuencias** — Positivas y negativas. Hay que listar ambas.
- **Alternativas consideradas** — Qué otras opciones se evaluaron y por qué no se eligieron.
- **Requisitos afectados** — Lista de `[[REQ-XXX]]` que motivan la decisión o se ven afectados por ella.

## Cuándo crear un ADR

- Se elige entre dos o más opciones técnicas **no triviales** (framework, ORM, estrategia de cache, modelo de auth, hosting).
- Se introduce una restricción que afectará a futuros REQs.
- Se descarta una tecnología candidata (documentar el "por qué no" es tan valioso como el "por qué sí").

**No** crear un ADR para:
- Decisiones menores de implementación (nombre de variable, formato de log).
- Convenciones de estilo (eso va en CLAUDE.md o linter config).
- Decisiones que se pueden revertir sin coste.

## Lifecycle

- Se crea con status `propuesto` durante discusión.
- Pasa a `aceptado` cuando se aprueba.
- Si se reemplaza por una decisión posterior, se marca `superseded` con `superseded_by: ADR-NNN`. El archivo **NO se borra**: queda como historia.
- Si simplemente deja de aplicar sin reemplazo, pasa a `deprecado`.

## Relación con los REQs

Los `related_reqs` permiten:
- Saber qué REQs hay que reevaluar si el ADR cambia.
- Justificar decisiones de implementación en los `change-NNN.md` ("la elección de Prisma viene de [[ADR-001]]").
- Al consultar un REQ, saber qué decisiones técnicas lo enmarcan.
