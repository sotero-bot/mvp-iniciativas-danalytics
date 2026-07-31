---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 02 · Componentes UI reutilizables

Regla de oro: **reutilizar antes de crear**. Antes de escribir markup nuevo,
busca en `components/ui/` (barrel: `components/ui/index.ts`).

## Inventario (`components/ui/`)

| Componente | Para |
|---|---|
| `Breadcrumb` | Miga de pan (dónde estoy). Primer elemento de la vista |
| `PageHeader` | Encabezado: eyebrow + título (Poppins) + descripción + acciones a la derecha |
| `Button` | Botón (`variant` primary/secondary/danger/success/link, `size='sm'`, `block`) |
| `Field` | Campo de formulario accesible (label asociado + hint + error) |
| `FormListLayout` | Vista de registro: formulario izquierda + listado derecha |
| `DataTable` | Tabla hairline con columnas tipadas; `align:'right'` para acciones |
| `FilterToolbar` | Fila de búsqueda + selects (`FilterToolbar.Divider`) |
| `Pagination` | Paginación (info izquierda, controles derecha) |
| `StatusBadge` | Badge de estado (`variant`: success/warning/danger/info/neutral) |
| `StatCard` | KPI / métrica |
| `ProgressBar` | Barra de progreso |
| `Alert` | Mensaje inline de estado en la vista |
| `EmptyState` | Estado vacío |
| `Loading` | Carga / spinner |
| `Modal` | Diálogo modal |

## Clases del CSS base (sin componente propio)
`.card` / `.card-accent`, `.section-card` (+ `-header` / `-title` / `-body`),
`.count-badge`, `.chip` (+ `.chip-dot`), `.next-step-banner`,
`.form-footer` / `.actions-end`, `.eyebrow`. Definidas en `index.css`.

## Cuándo crear uno nuevo
Solo si el patrón se repite y no encaja en lo existente. Ubicación:
- Reutilizable en toda la app → `components/ui/` + exportar en `index.ts`.
- Específico de un dominio → junto a la página en `features/<dominio>/`.

## Anti-patrones
- Reimplementar un botón/tabla/modal/badge que ya existe.
- Copiar estilos inline de otra vista en vez de usar la clase/componente.
