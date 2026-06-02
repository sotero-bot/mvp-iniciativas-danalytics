# Validación de cambios

> **Required reading:** [`principles.md`](principles.md).
>
> **Cuándo aplica:** todo cambio implementado por [`/change-req`](../workflows/change-req.md) (fase 3, implementer) debe pasar las tres capas antes del checkpoint 2 humano.

## Capa 1 — Tests automáticos obligatorios

Generados por el agente **implementer** durante la fase 3 de `/change-req`. Requisitos:

- Cada `change-NNN.md` debe traducirse en **al menos un test** que valide los criterios de aceptación ADDED o MODIFIED.
- Los tests existentes asociados al REQ (vistos en el `manifest.md`) deben **seguir pasando**.
- Tests de regresión para REQs `needed_by` (los que dependen de este) deben **seguir pasando**.
- **No usar el mismo agente para implementar y testear** sin precaución. Los tests los genera el implementer pero **a partir de los criterios de aceptación del Delta Spec**, NO de su propio código. Esto evita la auto-validación circular: si el agente escribe tests basados en lo que codificó, los tests heredan las mismas asunciones erróneas y se validan a sí mismos. La fuente de verdad de los tests es el spec, no la implementación.

## Capa 2 — Checklist humano

El implementer genera un checklist con los casos a probar **a ojo**, basado en los criterios de aceptación del Delta Spec. Ejemplo:

```
- [ ] Iniciar sesión con Google: el botón abre el popup de Google.
- [ ] Sesión expira a los 30 min de inactividad (verificable en logs).
- [ ] Aviso de expiración aparece a los 25 min.
- [ ] En navegador con cookies bloqueadas: muestra mensaje claro, no loop.
```

El humano marca cada caja antes de aprobar el checkpoint 2.

## Capa 3 — Smoke test en dev server

El implementer arranca el dev server localmente (o el equivalente del stack) y verifica que:

- La aplicación inicia sin errores.
- Los endpoints/páginas tocadas por el cambio responden 200 / renderizan sin errores en consola.
- La migración aplica sin errores en una BD local de prueba.

## Si alguna capa falla

- Capa 1 o 3 falla → el cambio **NO** va a checkpoint 2. Vuelve al implementer.
- Si la falla revela un problema en el **plan** (no en la implementación), vuelve a fase 1 del flujo `/change-req`. El `change-NNN.md` NO se modifica salvo que la ambigüedad detectada justifique un nuevo Delta Spec (ver [principio 7 en `principles.md`](principles.md)).

## Recomendaciones complementarias (opcionales)

Según contexto del proyecto, considerar:

- **Pruebas Basadas en Propiedades (PBT)** para validar invariantes de negocio. Útil cuando hay reglas matemáticas (saldos, conversiones, contadores).
- **Pruebas de Caminos de Error y Contratos de API** para forzar interrupciones de red, latencia, agotamiento de recursos y validar esquemas de respuesta. Mitiga alucinaciones en llamadas a APIs externas.
- **Behavioral Diff** en refactorizaciones críticas: ejecutar versión antigua y nueva en paralelo con las mismas entradas para verificar equivalencia.

Estas no son obligatorias por defecto pero se recomiendan según riesgo del cambio. El planner puede sugerirlas en el plan cuando detecte que aplican.
