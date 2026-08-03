---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 01 · Estructura de página

## Ubicación
Una página vive en `features/<dominio>/<Nombre>Page.tsx`. Los subcomponentes de
esa página van en la misma carpeta del dominio.

## Orden de una vista
Toda vista sigue este orden:

```tsx
<Breadcrumb items={...} />          {/* dónde estoy */}
<PageHeader eyebrow title description actions />
{/* contenido: listado, form+listado, etc. */}
```

## Aprovecha el ancho (no dejar espacio muerto a los lados)
- El contenido se renderiza dentro de `.main-content`, que ya trae el padding
  de página (`--page-pad-x` / `--page-pad-y`) y ocupa el ancho disponible.
- **No** envuelvas la vista en un contenedor con `max-width` centrado
  (`.page`, `max-width:1100px`, `margin:0 auto`) salvo en vistas de solo
  lectura o de un único formulario estrecho. Los listados, tablas y vistas
  densas van a **ancho completo**.
- No uses anchos fijos en px para columnas; usa grids con `fr` / `minmax(0, …)`.

## Breadcrumb (miga de pan) — obligatorio
- Toda vista lleva `<Breadcrumb>` como primer elemento. Indica **dónde está**
  el usuario.
- Cuando la vista depende de una **entidad seleccionada** (un programa, una
  empresa, una actividad), esa entidad **debe** aparecer como segmento del
  breadcrumb y como `eyebrow` del `PageHeader`. Ejemplo: al entrar a una acción
  de un programa, el breadcrumb es `Programas / <Nombre del programa> / <Acción>`
  y el eyebrow del header repite `<Nombre del programa>`. Nunca dejar que la
  vista cambie sin decir a qué entidad pertenece.
- El último segmento es la vista actual (no enlazado).
- **Nunca un UUID/ID crudo como segmento o `eyebrow`.** El segmento de la
  entidad seleccionada siempre es su nombre (u otro string legible de sus
  registros: nombre, título, código), nunca el `id` de la URL/ruta. Si el
  endpoint que ya carga la vista no trae el nombre, resuélvelo con una
  petición aparte — patrón de referencia en `FacilitadorGruposPage`,
  `FacilitadorSesionesPage`, `FacilitadorObservacionesPage`,
  `FacilitadorRetoPage` y `FacilitadorAsistenciaPage`:
  ```tsx
  const [programaNombre, setProgramaNombre] = useState('');
  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`) // o el endpoint que liste/detalle la entidad
      .then(res => res.json())
      .then((data: { id: string; nombre: string }[]) => {
        const p = data.find(x => x.id === programaId);
        if (p) setProgramaNombre(p.nombre);
      })
      .catch(() => {});
  }, [programaId]);
  // uso: { label: programaNombre || '—' } / eyebrow={programaNombre || undefined}
  ```
  El `|| programaId` como placeholder transitorio **también rompe la regla**:
  aunque sea momentáneo, el usuario alcanza a ver el UUID crudo mientras
  resuelve la petición. Usa `|| '—'` (o similar) como placeholder — nunca el
  `id` de la ruta, ni siquiera transitoriamente.

## Encabezado (`PageHeader`)
- `eyebrow`: contexto (paso, sección o entidad seleccionada). Uppercase, acento.
- `title`: en Poppins (fuente de marca, lo aplica el CSS). Ya traducido.
- `description`: subtítulo corto opcional.
- `actions`: acción(es) de la vista, **a la derecha** (el componente ya las
  alinea). El botón primario aquí es navy. → [05](05-feedback.md)

## Anti-patrones
- Contenedor centrado angosto en vistas de datos → desperdicia los lados.
- Vista sin breadcrumb, o breadcrumb que no refleja la entidad seleccionada.
- `<h1>` suelto con estilos inline en vez de `PageHeader`.
- Usar el `id`/UUID de `useParams()` directamente como `label` del breadcrumb
  o como `eyebrow` — siempre resuelve el nombre.
