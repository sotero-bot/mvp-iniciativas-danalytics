---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 04 · Estados de la vista (loading / vacío / error)

Toda vista con datos remotos maneja explícitamente sus tres estados. Orden de
precedencia: **loading → error → vacío → contenido**.

## Carga
`<Loading />` mientras se resuelve la petición. No dejes la pantalla en blanco.

## Vacío
`<EmptyState />` cuando la petición resolvió pero no hay datos. Copy claro y,
si aplica, una acción para crear el primer registro.

## Error
`<Alert variant="danger">` para errores de la vista/petición (mensaje ya
mapeado a `t('errors:CODE')`). → [07](07-datos-y-errores.md).

## Badges de estado (`StatusBadge`)
Mapea el estado de dominio a la variante:

| Estado | Variante | Color |
|---|---|---|
| Finalizado / activo / éxito | `success` | verde `--color-success` |
| En progreso / pendiente-acción | `warning` | ámbar `--color-warning` |
| Pendiente / inactivo | `neutral` | gris `--color-text-muted` |
| Error / rechazado | `danger` | rojo `--color-danger` |
| Informativo | `info` | azul `--color-accent` |

Nunca construyas el badge con hex inline; usa `StatusBadge`.

## Anti-patrones
- Pantalla en blanco durante la carga.
- Spinner infinito si la petición falla (falta el estado de error).
- Error tragado (sin `Alert` ni toast).
