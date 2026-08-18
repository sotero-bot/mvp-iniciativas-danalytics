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
| `InfoTooltip` | Ícono "?" junto a un label con explicación larga/secundaria al hover/foco. → [06](06-formularios.md) |
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

### Paneles elevados: Inicio por rol y vistas del administrador (`.home-*`)
El **Inicio** de cada rol (`features/home/`, `admin/DashboardPage`,
`facilitador/ProgramasPage`) se eleva dentro del sistema. Cada
sección del Inicio es un **panel grande** `.section-card` (con
`.section-card-header` — título + `.count-badge` o `.home-section-note` — y
`.section-card-body`), igual que el resto de la app; **no** uses secciones
sueltas ni encabezados sobre rejillas abiertas (el revisor lo leyó como
"cuadritos sin contenedor"). Dentro de cada panel va el contenido elevado.
Clases (todas planas, rectas, hairline — la modernidad viene del ritmo, la
escala del número y **un solo gesto de hover**: borde → navy + flecha que
avanza):
- **Cabecera navy (`home-panel`).** Añade la clase `home-panel` al
  `.section-card` para que su cabecera use el navy de marca (título blanco,
  contador/nota en blanco translúcido, sin la línea hairline). Se aplica a
  **todos los paneles del inicio por rol y a todas las vistas del
  administrador** (`features/admin/*`, Empresas/Iniciativas de
  `organization/`, Actividades/Plantillas de `methodology/` e Instancias de
  `execution/`). Los controles que
  vivan **dentro** de la cabecera navy se invierten solos vía CSS
  (`.home-panel .section-card-header .btn-primary/-secondary/-link` y
  `.info-tooltip-trigger`) para no perderse sobre el fondo — no necesitas
  estilos inline. Es una desviación acotada de la Sparse Navy Rule (ver 03):
  **no** la conviertas en global sobre `.section-card-header`; las vistas de
  facilitador/estudiante/cliente que no sean su inicio conservan cabecera clara
  salvo que se pida explícitamente.
  - **Pedido explícito ya aplicado.** `facilitador/RetoPage.tsx`,
    `facilitador/SesionesPage.tsx`, `facilitador/GruposPage.tsx`,
    `facilitador/ObservacionesPage.tsx`, `facilitador/ResultadosPage.tsx` y
    `estudiante/SesionesPage.tsx` envuelven **todo** su contenido (pestañas,
    controles de acción y listados) en uno o más `.section-card.home-panel`,
    a petición directa del usuario, aunque no son vistas de Inicio ni de
    admin. Úsalas como referencia si te piden lo mismo en otra vista de
    facilitador/estudiante/cliente: cada sección lógica de la vista (cada
    listado o recurso distinto) es su propio `.section-card.home-panel` con
    `section-card-title` + `count-badge` propios (nunca repitiendo el
    `title` del `PageHeader`); si hay más de un panel, sepáralos con
    `.home-stack` (no `marginTop` manual).
- `.home-stack` — columna que separa los paneles del inicio (gap `--space-6`).
- `.home-kpi-grid` — rejilla de KPIs (usa el componente `StatCard`), dentro del
  cuerpo de un panel.
- `.home-nav-grid` + `.home-nav-card` (`-icon` / `-title` / `-desc` / `-foot` /
  `-arrow`, variante `.is-disabled`) — tarjetas de navegación por rol.
- `.home-list` + `.home-list-row` (`-dot` / `-text` / `-arrow`) — lista de
  pendientes (filas hairline, no tarjetas).
- `.home-next` (`-top` / `-program` / `-title` / `-meta`) — tarjeta destacada
  de "próxima sesión".
- `.home-prog-card` (`-name` / `-empresa` / `-progress-label` / `-foot` /
  `-grupo`) — tarjeta de programa con progreso del estudiante.
- `.home-filter-strip` — franja de filtros **dentro** de un panel (entre la
  cabecera y el cuerpo): fondo blanco heredado del panel, sin borde ni relleno
  vertical propio (solo el horizontal, `1.75rem`, para alinear con la cabecera).
  Es el patrón sancionado para meter un `<FilterToolbar>` (o un `.toolbar`)
  dentro del panel de un listado, en vez de dejarlo suelto encima. Se usa en
  todas las vistas de listado del administrador (Programas, Usuarios,
  Observaciones, Notificaciones, Registro de acceso, Instancias…).

**Tarjetas de igual altura en una rejilla.** Cuando una fila de tarjetas
comparte rejilla (`.home-nav-grid` o un `grid` propio), el grid ya las estira a
la misma altura; para que además las acciones/pie queden alineados, el bloque
de acciones o el pie lleva `margin-top: auto` (así se ancla al fondo aunque el
título/metadatos ocupen distinto alto). Ya lo aplican `.home-nav-card-foot`,
`.home-prog-foot` y la fila de botones de la tarjeta de programa del
facilitador. Replica ese `margin-top: auto` en cualquier tarjeta nueva de una
rejilla de inicio.

**Convención — vista de listado del administrador.** Una vista admin que lista
datos (tabla o colección) **no** cuelga el `DataTable`/listado suelto bajo el
`PageHeader`: lo envuelve en un panel titulado. Composición estándar:

```tsx
<div className="section-card home-panel">
  <div className="section-card-header">
    <span className="section-card-title">{t('...:list_title')}</span>
    <span className="count-badge">{items.length}</span>
  </div>
  <div className="home-filter-strip">{/* <FilterToolbar> o .toolbar */}</div>
  {loading && <Loading />}
  {!loading && items.length === 0 && <EmptyState />}
  {!loading && items.length > 0 && <DataTable … />}
</div>
```

- El botón primario de crear ("+ Nuevo …") sigue en `PageHeader actions` (sobre
  fondo claro), **no** dentro de la cabecera navy.
- El título del panel es una clave i18n propia (`list_title`), distinta del
  `title` del `PageHeader`, para no repetir el `h1`. Añádela en `es` y `pt`.
- Referencias: `admin/ProgramasPage`, `admin/UsuariosPage`,
  `admin/RegistroAccesoPage`, `admin/AdminObservacionesPage`,
  `execution/InstanciasPage`.

`StatCard` acepta `icon` (un `<SidebarIcon>` en un cuadro teñido), `accent`
(hex categórico de sección — excepción sancionada, ver 03) y `to` (convierte
el tile en un enlace navegable con flecha). Fuera del Inicio, un KPI simple
sigue siendo `label` + `value` + `hint`.

## Cuándo crear uno nuevo
Solo si el patrón se repite y no encaja en lo existente. Ubicación:
- Reutilizable en toda la app → `components/ui/` + exportar en `index.ts`.
- Específico de un dominio → junto a la página en `features/<dominio>/`.

## Anti-patrones
- Reimplementar un botón/tabla/modal/badge que ya existe.
- Copiar estilos inline de otra vista en vez de usar la clase/componente.
