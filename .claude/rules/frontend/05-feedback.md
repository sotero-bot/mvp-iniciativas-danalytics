---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 05 · Feedback y botones de acción

## Botones (`Button`)
- **Acción principal (confirmar / enviar / crear) = `variant="primary"`**:
  azul navy de empresa. Una sola por vista/sección.
- Secundaria = `variant="secondary"` (contorno). Destructiva =
  `variant="danger"` (contorno rojo). Acción inline en tablas = `size="sm"` o
  `variant="link"`.

## Posición: los botones de acción van SIEMPRE a la derecha
- En el encabezado: dentro de `<PageHeader actions>` (ya alineado a la derecha).
- Al pie de un formulario / modal: en un contenedor `.form-footer` (o
  `.actions-end`), que alinea a `flex-end`. El primario va el más a la derecha;
  el secundario/cancelar a su izquierda.
- Si el formulario es una sola columna, el submit puede ir a todo el ancho
  (`<Button block>`) al final; sigue siendo el navy primario.
- Nunca dejes el botón de confirmar/enviar a la izquierda ni centrado en vistas
  con más contenido.

```tsx
<div className="form-footer">
  <Button variant="secondary" onClick={onCancel}>{t('common:cancel')}</Button>
  <Button type="submit">{t('common:save')}</Button>
</div>
```

## Toasts (`toast-store`)
Resultado de una mutación → `toast.success(...)` / `toast.error(...)` de
`components/toast-store`. Pila global arriba a la derecha, 5s, verde/rojo. No
uses el patrón viejo de aviso por página ni `alert()` nativo.

## Confirmaciones (`ConfirmModal`)
Acciones destructivas o irreversibles (eliminar, desmatricular) se confirman con
`ConfirmModal` antes de ejecutarse. El botón de confirmar del modal usa
`variant="danger"` si destruye datos.

## Anti-patrones
- Botón primario duplicado compitiendo por atención.
- Acción de confirmar/enviar a la izquierda o centrada.
- Mutación sin toast (el usuario no sabe si funcionó).
- `alert()` / `confirm()` nativos.
