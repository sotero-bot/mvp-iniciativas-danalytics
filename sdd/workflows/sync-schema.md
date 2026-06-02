# Workflow: `/sync-schema`

> Regenera el diagrama ER (`database/diagram.mmd`) desde el schema fuente.
>
> **Required reading antes de ejecutar:**
> - [`../README.md`](../README.md)
> - [`../reference/github-actions.md`](../reference/github-actions.md) (versión CI del mismo proceso)

## Propósito

Versión local del GitHub Action que regenera el diagrama ER. Útil cuando el dev quiere ver el diagrama actualizado **sin esperar al CI** tras un cambio de schema.

`database/diagram.mmd` es **autogenerado**. NO se edita a mano (ver regla dura #4 en [`../concepts/principles.md`](../concepts/principles.md)).

## Pasos

1. **Detectar el stack** leyendo `docs/tech-stack.md`.

2. **Identificar el archivo fuente del schema:**
   - Si stack con Prisma → `prisma/schema.prisma`.
   - Si stack con Django → modelos en `<app>/models.py`.
   - Si stack SQL plano → `database/schema.sql`.
   - Otros → según lo que `docs/tech-stack.md` indique.

3. **Ejecutar el comando de regeneración** según el stack:
   - **Prisma:** `npx prisma generate` (asumiendo `prisma-erd-generator` configurado).
   - **SQL plano:** `python scripts/sql_to_mermaid.py` (asumiendo el script de [`../reference/github-actions.md`](../reference/github-actions.md) instalado).
   - **Django:** `python manage.py graph_models -a -o database/diagram.png` con `django-extensions` (o adaptar).

4. **Verificar que `database/diagram.mmd` se actualizó.** Si no cambió, informar: "Schema sin cambios desde la última generación."

5. **Mostrar el diagrama al usuario** (path al archivo + sugerir cómo visualizarlo en VSCode o GitHub).

## Outputs

- `database/diagram.mmd` regenerado (si hubo cambios en el schema).

## Cuándo usarlo

- Tras modificar `schema.sql` o `schema.prisma` localmente y querer ver el diagrama antes de commitear.
- Tras un `pull` que trajo cambios de schema y el `diagram.mmd` no se actualizó por algún motivo (CI fallido, conflict mal resuelto).

## Errores comunes

- **Stack no detectado.** Si `docs/tech-stack.md` no especifica claramente, preguntar al usuario qué generador usar.
- **Generador no instalado.** Si falta `prisma-erd-generator` o el script `sql_to_mermaid.py`, recordar al usuario que [`/init-project`](init-project.md) los configura. Si el proyecto es viejo, instalar manualmente.
- **Editar `diagram.mmd` a mano y luego regenerar.** Las ediciones manuales se pierden. Cualquier customización debe hacerse al script generador, no al output.
