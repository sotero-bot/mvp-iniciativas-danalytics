---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 09 · Responsive y accesibilidad

## Responsive
- Breakpoint de referencia: **768px** (definido en `index.css`).
- Usa grids con `fr` / `minmax(0, …)`, no anchos fijos en px. Los grids del CSS
  base ya colapsan en móvil: `.form-list-grid` apila, `.pagination` apila,
  `.form-grid` pasa a una columna.
- El `.filter-bar` ya hace `flex-wrap`; no fuerces una sola fila.
- Nada de scroll horizontal en la página: las tablas anchas van dentro de
  `.table-container` (que ya hace `overflow-x:auto`) — no la página entera.

## Semántica
- Títulos jerárquicos (un `h1` por vista, vía `PageHeader`).
- Botón vs. enlace: acción → `<Button>`; navegación → `<Link>`.
- `Breadcrumb` es `<nav aria-label>`; el ítem actual lleva `aria-current`.

## Accesibilidad
- Todo control de formulario con label asociado → usa `Field` (no labels
  sueltos).
- No quites el foco visible: `--shadow-focus` en inputs y el `:focus-visible`
  global. Los tokens de color ya cumplen contraste AA.
- Íconos-only clicables llevan `aria-label`.

## Anti-patrones
- `div` clicable sin rol/teclado en vez de `button`/`Link`.
- Ancho fijo que provoca scroll horizontal en móvil.
- Quitar el outline de foco "porque se ve mejor".
