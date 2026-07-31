---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 06 · Formularios

## Campo (`Field`)
Todo campo usa `<Field label required hint error>` envolviendo el control
(`.input` / `.textarea` / `select.input`). El label queda asociado al control
(accesibilidad). El asterisco de requerido lo pone `required`; los opcionales
se marcan en el label con "(opcional)".

## Registro con listado: formulario + listado lado a lado
En vistas de registro (crear una entidad y ver las ya creadas), el formulario
va a la **izquierda** y el **listado de lo ya registrado a la derecha** (más
ancho). Patrón de referencia: `/admin/iniciativas`.

Usa `<FormListLayout form={...} list={...} />`. El listado suele ser un
`.section-card` con `.section-card-header` (título + `count-badge`) y un
`<DataTable>`. En móvil se apila (formulario arriba, listado debajo) — ya lo
resuelve el CSS.

```tsx
<FormListLayout
  form={<div className="card"> … campos … <div className="form-footer">…</div></div>}
  list={
    <div className="section-card">
      <div className="section-card-header">
        <span className="section-card-title">{t('...:registered')}</span>
        <span className="count-badge">{items.length}</span>
      </div>
      <DataTable columns={columns} rows={items} rowKey={r => r.id} />
    </div>
  }
/>
```

## Submit
- Botón primario navy, a la derecha (`.form-footer`) o `block` al pie si el form
  es de una columna. → [05](05-feedback.md).
- Deshabilita el botón mientras se envía (`disabled` + estado de carga) para
  evitar doble envío.
- En `useEffect` que dispara POST, usa el guard con `useRef` (no
  `AbortController` combinado) por el doble efecto de StrictMode.
  → [07](07-datos-y-errores.md).

## Validación
- Marca errores por campo con el prop `error` de `Field`.
- Los errores del backend se muestran mapeados a `t('errors:CODE')`, no el
  mensaje crudo. → [07](07-datos-y-errores.md).

## Anti-patrones
- Inputs sin `Field`/label asociado.
- Formulario de registro sin el listado de lo ya registrado al lado.
- Submit sin bloqueo (permite doble envío).
