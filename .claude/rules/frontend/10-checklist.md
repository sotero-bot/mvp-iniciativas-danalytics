---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 10 · Checklist de vista terminada

Repasar antes de dar por completada cualquier vista nueva o modificada.

## Estructura
- [ ] Archivo en `features/<dominio>/`; primer elemento es `<Breadcrumb>`, luego `<PageHeader>`.
- [ ] El breadcrumb y el eyebrow reflejan la entidad seleccionada (si la vista depende de una) — con su **nombre**, nunca el UUID/ID crudo.
- [ ] Ancho completo; sin contenedor angosto centrado que desperdicie los lados.

## Estilo (sobrio)
- [ ] Solo tokens `var(--...)`; ningún hex/px hardcodeado.
- [ ] Esquinas rectas, sin sombras en cards; tipografía Poppins en todo (cuerpo y títulos).
- [ ] Azul navy solo para acción/jerarquía.

## Componentes
- [ ] Reutiliza `components/ui/` y clases base; no reinventa botón/tabla/badge.

## Botones y feedback
- [ ] Acción de confirmar/enviar = `Button` primary (navy), a la derecha (`.form-footer` / `PageHeader actions`).
- [ ] Mutaciones dan toast; acciones destructivas confirman con `ConfirmModal`.

## Formularios
- [ ] Campos con `Field` (label asociado); submit bloquea doble envío.
- [ ] Vista de registro usa `FormListLayout` (formulario izquierda + listado derecha).
- [ ] Labels sin abreviaturas/símbolos crudos; explicación corta y crítica visible siempre, explicación larga en `InfoTooltip`. → [06](06-formularios.md)

## Estados y datos
- [ ] loading / vacío / error cubiertos.
- [ ] Peticiones vía `fetchWithErrorMapping`; errores mapeados a `t('errors:CODE')`.

## i18n
- [ ] Sin literales en español; paridad `es`/`pt`.

## Responsive y accesibilidad
- [ ] Funciona en móvil (grids colapsan, sin scroll horizontal de página).
- [ ] Accesible por teclado; foco visible; labels asociados.
