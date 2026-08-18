---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 03 · Estilos y design tokens

Toda decisión visual usa los tokens de `index.css` (`:root`). **Prohibido**
hardcodear color/spacing/radio/sombra: siempre `var(--...)`.

## Color

El **azul navy es el color de la empresa**: se usa para jerarquía y acción, no
para decorar.

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#0F2A4A` | Marca; botón primario, activo, títulos de énfasis |
| `--color-primary-hover` | `#14385F` | Hover del primario |
| `--color-accent` | `#155BA0` | Acento: eyebrow, puntos, detalles |
| `--color-link` | `#0F3D6B` | Enlaces |
| `--color-bg-page` | `#F7F6F3` | Fondo cálido de página |
| `--color-bg-card` | `#FFFFFF` | Superficies (cards, paneles) |
| `--color-bg-subtle` | `#EEF1F5` | Fondos suaves (chips) |
| `--color-text-heading` | `#0F1720` | Títulos |
| `--color-text-main` | `#1C1F24` | Texto principal |
| `--color-text-secondary` | `#5A606A` | Texto secundario |
| `--color-text-muted` | `#6B7078` | Etiquetas, meta, cabeceras de tabla |
| `--color-text-tertiary` | `#9AA1AB` | Placeholder, deshabilitado |
| `--color-border` | `rgba(15,42,74,.12)` | Borde hairline (cards, tablas) |
| `--color-border-strong` | `rgba(15,42,74,.22)` | Borde de inputs |
| `--color-border-soft` | `rgba(15,42,74,.06)` | Separador de filas |

Estados: `--color-{success,warning,danger,info}` (+ `-bg`, `-border`, `-strong`).
→ [04](04-estados.md).

**Excepción sancionada — acentos categóricos de sección.** `ROLE_CARDS`
(`features/home/HomePage.tsx`) usa hex literales (no tokens) para darle un
color distinto a cada sección del panel admin (empresas/programas/usuarios/
actividades), reutilizado tal cual en los íconos del sidebar de `App.tsx`
(el propio código comenta por qué). Es intencional — identifica la sección
de un vistazo — y no debe normalizarse a la paleta navy/neutra. Ver
DESIGN.md → Colors → "Acentos categóricos de sección".

**Excepción sancionada — cabecera navy de los paneles (`.home-panel`).** Los
paneles marcados con `.home-panel` (ver [02](02-componentes-ui.md)) pintan su
`.section-card-header` con `--color-primary` (navy) y título blanco. Se usa en
**el inicio de cada rol y en todas las vistas del administrador**. Es una
desviación **deliberada** de la Sparse Navy Rule ("navy solo para
acción/jerarquía, nunca como fondo decorativo"), pedida por el cliente para que
los paneles se lean como grandes contenedores. Los botones/links/tooltip que
vivan en una cabecera navy se **invierten** vía CSS (`.home-panel
.section-card-header .btn-*` / `.info-tooltip-trigger`) para no perderse; por eso
un botón primario en la cabecera se ve como botón blanco. Aun así, **no**
conviertas `.section-card-header` en navy de forma global: los flujos que no son
inicio ni admin conservan cabecera clara salvo petición explícita — ya aplicado
en `facilitador/RetoPage.tsx`, `facilitador/SesionesPage.tsx`,
`facilitador/GruposPage.tsx`, `facilitador/ObservacionesPage.tsx`,
`facilitador/ResultadosPage.tsx` y `estudiante/SesionesPage.tsx` (ver
[02](02-componentes-ui.md)). Ver DESIGN.md → Home.

## Tipografía
- **`Poppins` es la tipografía de marca de la empresa: se usa SIEMPRE**, en
  cuerpo y en todos los títulos (h1–h4, `.section-card-title`, etc.) —
  `--font-family`. No existe una variable de fuente serif; no la
  reintroduzcas. La jerarquía de títulos se logra con tamaño/peso
  (`font-weight`), no cambiando de tipografía.
- Eyebrow / etiquetas de cabecera: uppercase, `letter-spacing` amplio, peso 600.

## Forma (sobrio)
- **Esquinas rectas.** Radios de card/input/botón son `0` (`--radius-*`). Solo
  píldoras usan `--radius-pill`; chips `--radius-chip` (2px).
- **Sin sombras** en superficies: cards y paneles son planos, borde hairline.
  Solo overlays/modales elevan (`--shadow-md` / `--shadow-overlay`).
- **Sin gradientes** de relleno.

## Espaciado
- Escala `--space-1..6`. Padding de página: `--page-pad-x` / `--page-pad-y`
  (ya aplicados en `.main-content`).
- Foco: `--shadow-focus` (anillo de acento). No lo quites de inputs.

## Anti-patrones
- Hex/rgb inline (`#2563EB`, `#fff`, `color:'#64748B'`) → usa el token.
- `border-radius` > 0 en cards/botones (rompe el estilo recto).
- `box-shadow` en cards.
- Cualquier fuente que no sea Poppins (serif, Inter, system-ui como fuente
  principal, etc.) en título o cuerpo — Poppins es la fuente de marca, siempre.
- **Un subsistema visual paralelo para un flujo específico** (paleta, sombra
  o radio propios, aunque sea para imitar deliberadamente el look de un
  producto externo — ej. "que se sienta como Google Forms"). Precedente real:
  `.gform-*` (formulario del estudiante) había desarrollado un acento teal
  (`#0D9488`) y sombras propias, distintos del resto de la app; se corrigió
  reemplazándolos por los tokens del sistema (`--color-primary`,
  `--shadow-focus`, sin `box-shadow` en reposo). Cualquier necesidad de
  identidad visual distinta para un flujo puntual se resuelve dentro de los
  tokens existentes, no inventando unos nuevos.
- Emoji como sistema principal de jerarquía/iconografía en pantallas de alta
  densidad (paneles de facilitador/admin) — compite con la jerarquía
  tipográfica y renderiza distinto por sistema operativo.
