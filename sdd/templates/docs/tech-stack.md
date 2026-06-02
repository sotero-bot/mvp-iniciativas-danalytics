# Plantilla: `docs/tech-stack.md`

> Define el stack técnico del proyecto.
>
> **Crítico:** la IA lee este archivo para determinar el sistema de migraciones a usar (ver [`../../reference/migrations-by-framework.md`](../../reference/migrations-by-framework.md)).
>
> Sin este archivo rellenado, [`/new-req`](../../workflows/new-req.md) se rechaza.

## Plantilla

```markdown
# Stack técnico

| Capa | Tecnología | Justificación / ADR |
|---|---|---|
| Frontend | Next.js 14 | [[ADR-002]] |
| ORM | Prisma | [[ADR-001]] |
| BD | PostgreSQL 16 | [[ADR-003]] |
| Hosting | Vercel + Supabase | [[ADR-004]] |
| Sistema de migraciones | `prisma migrate dev` | — |

## Integraciones externas obligatorias
- <Stripe / Auth0 / SendGrid / ...>

## Restricciones técnicas no negociables
- <Ej: latencia p95 < 300ms en API>
- <Ej: app debe funcionar sin cookies de terceros>
```

## Cómo rellenar

- **Tabla de capas** — Una fila por capa relevante: frontend, backend/API, ORM, BD, autenticación, cache, queue, storage, hosting, monitoring, sistema de migraciones. Enlazar al ADR donde se justificó la elección.
- **Sistema de migraciones** — Campo crítico. Ver [`../../reference/migrations-by-framework.md`](../../reference/migrations-by-framework.md). Si el stack no aparece en esa tabla, [`/init-project`](../../workflows/init-project.md) preguntará y ayudará a decidir.
- **Integraciones externas obligatorias** — APIs/servicios externos que el sistema usa. La IA debe saberlo para no inventar integraciones que no existen y para generar errores categoría `alucinacion_ia` si se desvía.
- **Restricciones técnicas no negociables** — Límites duros (latencia, throughput, footprint). El planner los considera al validar cambios.

## Para qué la usa la IA

- **`/init-project`** lee la tabla y detecta automáticamente el sistema de migraciones.
- **Planner de `/change-req`** la consulta para no proponer cambios incompatibles con el stack.
- **Implementer de `/change-req`** la usa para generar la migración correcta según el ORM/framework.
- **`/audit`** la cruza con el código para detectar uso de tecnologías no aprobadas (drift de stack).

## Cuándo actualizarla

- Cuando se aprueba un ADR que cambia una decisión de stack.
- Cuando se añade una integración externa nueva.
- Cuando cambia una restricción técnica.

**Cambios en este archivo deben ir acompañados de un ADR** (excepto cuando es la primera vez que se rellena en `/init-project`).
