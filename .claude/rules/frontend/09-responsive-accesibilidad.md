---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 09 · Responsive y accesibilidad

## Responsive
- Breakpoint de referencia para apilar en **móvil**: **768px** (definido en
  `index.css`). `.pagination` apila, `.form-grid` pasa a una columna ahí.
- **Layouts de dos columnas en desktop (`.form-list-grid` y similares) NO
  deben pensarse solo en términos de "móvil vs. desktop".** El ancho de
  contenido real es `viewport − 240px (sidebar) − 112px (padding de página)`:
  un monitor 1080p (1920px) deja solo **~1568px** de contenido, mientras uno
  2K (2560px) deja **~2208px**. Un ratio fijo tipo `0.85fr / 1.15fr` que se
  ve bien en 2K queda apenuscado en 1080p — que es el monitor más común, no
  el caso raro. Por eso `.form-list-grid` apila a **una columna por debajo de
  2100px de viewport** (no solo por debajo de 768px): a esa proporción, 1080p
  sin escalar también entra en el caso apilado. Si agregas un nuevo layout de
  dos columnas en una vista con `.form-list-grid` o similar, replica este
  mismo umbral (~2000–2100px) en vez de usar solo el breakpoint móvil de
  768px.
- Usa grids con `fr` / `minmax(…)` con un piso razonable (ej.
  `minmax(320px, 0.85fr)`), no `minmax(0, …)` sin piso: sin piso, la columna
  se puede seguir encogiendo indefinidamente en vez de forzar el apilado.
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
