# Sistemas de migración por framework

> Tabla de referencia que [`/init-project`](../workflows/init-project.md), el agente implementer de [`/change-req`](../workflows/change-req.md) y [`/rollback`](../workflows/rollback.md) usan para saber qué sistema de migraciones aplicar.

## Tabla principal

| Framework | Lenguaje | Sistema de migraciones | Comando típico (up) | Comando típico (down) |
|---|---|---|---|---|
| Next.js | TypeScript/JS | Prisma | `npx prisma migrate dev` | `npx prisma migrate resolve --rolled-back <name>` |
| Nuxt | TypeScript/JS | Prisma o Drizzle | `npx prisma migrate dev` o `drizzle-kit push` | varía |
| SvelteKit | TypeScript/JS | Prisma o Drizzle | `npx prisma migrate dev` o `drizzle-kit push` | varía |
| Django | Python | `makemigrations` / `migrate` | `python manage.py migrate` | `python manage.py migrate <app> <previous_migration>` |
| RedwoodJS | TypeScript/JS | Prisma (integrado) | `yarn rw prisma migrate dev` | `yarn rw prisma migrate resolve --rolled-back` |
| FastAPI | Python | Alembic | `alembic upgrade head` | `alembic downgrade -1` |
| Laravel | PHP | `artisan migrate` | `php artisan migrate` | `php artisan migrate:rollback` |

## Fallback para frameworks no listados

Si el framework no aparece en la tabla, [`/init-project`](../workflows/init-project.md) **pregunta al usuario** qué sistema de migraciones se usará, ofreciendo opciones similares a Django (sistema declarativo con migraciones autogeneradas a partir de modelos):

| Si el framework es... | Considerar |
|---|---|
| Ruby on Rails | `rails db:migrate` / `rails db:rollback` |
| Spring Boot (Java) | Flyway o Liquibase |
| Phoenix (Elixir) | `mix ecto.migrate` / `mix ecto.rollback` |
| Symfony (PHP) | Doctrine Migrations |
| .NET Core | EF Core Migrations |
| **Otro / desconocido** | Flyway como fallback genérico SQL-based |

Si ninguna opción encaja, preguntar al usuario explícitamente qué herramienta usar y registrarlo en `docs/tech-stack.md`.

## Cómo lo usa cada workflow

- **`/init-project`** lee `docs/tech-stack.md`, cruza con esta tabla y registra el sistema. Si no hay match, pregunta y crea ADR si la decisión es no trivial.
- **`/change-req` (implementer)** consulta esta tabla para generar la migración correcta cuando el Delta Spec tiene cambios de schema.
- **`/rollback`** usa la columna "Comando típico (down)" para generar el comando de migración inversa.

## Buenas prácticas independientes del framework

- **Migraciones up + down siempre que sea posible.** Reversibilidad es seguridad.
- **No editar migraciones ya aplicadas en producción.** Si necesitas corregir, crear una migración nueva que arregle.
- **Migraciones destructivas requieren respaldo previo.** Drop de columna, truncate, alter type que pierde datos: avisar explícitamente al usuario.
- **Probar la migración down en local antes de mergear.** Garantiza que el rollback será posible si se necesita.
- **Versionar las migraciones en git.** Carpeta `database/migrations/` siempre va al repo.
