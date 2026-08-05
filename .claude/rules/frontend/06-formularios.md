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

## Labels explícitos — el usuario objetivo es lento y no relee la pantalla
Se asume que quien llena el formulario **no va a inferir** abreviaturas,
símbolos ni convenciones implícitas, y que la interfaz no debe recargarse con
párrafos de ayuda permanentes. Regla práctica para decidir cómo aclarar un
campo:

- **Abreviaturas y símbolos → nunca.** "Nº", "F. inicio", "%" solos no son
  válidos como label. Usa la palabra completa y, si aplica, el sustantivo que
  aclara qué representa: "N.º de sesión" en vez de "Nº"; "Fecha de inicio" en
  vez de "F. inicio".
- **Explicación corta (cabe en el label o en una línea siempre visible) →
  ponla directamente**, en el label mismo o como texto permanente bajo el
  campo/sección (`Field hint`, o un `<div>` de texto secundario si es a nivel
  de grupo/`fieldset`). No la escondas detrás de un ícono si es información
  crítica para completar el campo correctamente (ej.: "elige un enlace O un
  archivo, no ambos").
- **Explicación larga o secundaria (contexto, ejemplos, quién debería
  llenarlo) → `InfoTooltip`** (`components/ui/InfoTooltip.tsx`) junto al
  label: `label={<>{t('...')}<InfoTooltip label={t('...hint')} /></>}`. Así no
  ocupa espacio permanente pero queda disponible con hover/foco (accesible por
  teclado).
- **Grupos de campos mutuamente excluyentes** ("un enlace O un archivo"):
  refuerza la relación visualmente, no solo con texto — un separador centrado
  ("O" / "OU" según el locale) entre las dos opciones, además del texto
  explicativo del grupo. Ver `SesionFormModal` (sección Presentación) en
  `features/admin/ProgramasPage.tsx` como referencia.

```tsx
<Field label={<>{t('admin:foo.fields.numero')}<InfoTooltip label={t('admin:foo.fields.numero_hint')} /></>} required>
  <input type="number" className="input" ... />
</Field>
```

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
- Label con abreviatura o símbolo sin desarrollar ("Nº", "F.ini.") cuando la
  palabra completa cabe igual.
- Esconder en un `InfoTooltip` una condición crítica para llenar el campo bien
  (esa va como texto siempre visible).
- Dos campos alternativos ("enlace o archivo") mostrados como si ambos fueran
  obligatorios, sin separador ni texto que aclare que basta con uno.
