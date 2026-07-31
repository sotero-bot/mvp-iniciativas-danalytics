---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# Estándar de vistas — Frontend (apps/web)

Reglas de estilo y estructura de vistas. Se cargan cuando trabajo con archivos
de vista (`.tsx` / `.css`) bajo `apps/web/src/`.

## Principios rectores

1. **Sobrio y elegante.** Superficies blancas sobre fondo cálido, esquinas
   rectas, sin sombras, bordes finos (*hairline*). Tipografía SIEMPRE Poppins
   (fuente de marca de la empresa), en cuerpo y títulos. Sin
   gradientes, sombras marcadas, esquinas redondeadas ni rellenos de color
   saturado.
2. **Aprovecha el ancho.** Las vistas ocupan el ancho disponible; no se deja
   espacio muerto a los lados. → [01](01-estructura-pagina.md)
3. **El azul navy es el color de la empresa.** Se reserva para jerarquía y
   acción (botón primario, acento, estado activo). → [03](03-estilos-tokens.md)
4. **Reutiliza antes de crear.** Primitivas en `components/ui/` y clases del CSS
   base (`index.css`). No reinventes estilos. → [02](02-componentes-ui.md)
5. **Tokens antes de literales.** Nada de color/spacing hardcodeado; siempre
   `var(--...)`. → [03](03-estilos-tokens.md)
6. **i18n siempre.** Nunca literales en español en JSX; siempre `t('ns:key')`.
   → [08](08-i18n.md)

## Índice de reglas

| # | Archivo | Cubre |
|---|---------|-------|
| 01 | [01-estructura-pagina.md](01-estructura-pagina.md) | Ancho completo, breadcrumb, header |
| 02 | [02-componentes-ui.md](02-componentes-ui.md) | Inventario `components/ui/`; reutilizar |
| 03 | [03-estilos-tokens.md](03-estilos-tokens.md) | Paleta, tipografía, forma, tokens |
| 04 | [04-estados.md](04-estados.md) | Loading / vacío / error; estados |
| 05 | [05-feedback.md](05-feedback.md) | Botones de acción, toasts, confirmaciones |
| 06 | [06-formularios.md](06-formularios.md) | Campos, form + listado lado a lado |
| 07 | [07-datos-y-errores.md](07-datos-y-errores.md) | `fetchWithErrorMapping`, errores |
| 08 | [08-i18n.md](08-i18n.md) | Traducciones |
| 09 | [09-responsive-accesibilidad.md](09-responsive-accesibilidad.md) | Móvil, accesibilidad |
| 10 | [10-checklist.md](10-checklist.md) | Checklist antes de terminar |

El CSS base vive en `apps/web/src/index.css`; los componentes en
`apps/web/src/components/ui/`. Valida contra [10](10-checklist.md) antes de
dar una vista por terminada.
