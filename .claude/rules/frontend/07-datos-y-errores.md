---
paths:
  - "apps/web/src/**/*.{tsx,css}"
---

# 07 · Datos y manejo de errores

## Peticiones
Toda llamada al backend pasa por `fetchWithErrorMapping`
(`shared/api/fetchWithErrorMapping.ts`). Nunca `fetch` crudo sin mapeo de
errores.

## Errores del backend
El backend responde `{ code, message, statusCode }`. En el front, el `code` se
traduce con `t('errors:CODE')` — **nunca** muestres el `message` crudo del
backend al usuario. Renderiza el resultado en `<Alert variant="danger">` (error
de vista) o `toast.error(...)` (error de una acción). → [04](04-estados.md),
[05](05-feedback.md).

## Efectos con POST (StrictMode)
En `useEffect` que dispara una mutación, protege con un guard `useRef` para que
el doble montaje de StrictMode no dispare dos veces. No combines
`AbortController` para esto.

```tsx
const sent = useRef(false);
useEffect(() => {
  if (sent.current) return;
  sent.current = true;
  // POST…
}, []);
```

## Estados de la petición
Conecta loading / error / vacío con [04](04-estados.md): mientras carga
`<Loading />`, si falla `<Alert>`, si no hay datos `<EmptyState />`.

## Anti-patrones
- `fetch` sin `fetchWithErrorMapping`.
- Mostrar `error.message` del backend en crudo.
- Tragar el error (catch vacío) sin feedback al usuario.
