---
id: change-003
req_id: REQ-011
title: Rediseño visual del Analytics Canvas
status: implementado
created: 2026-06-03
supersedes: change-001
---

# change-003 — Rediseño visual del Analytics Canvas

## Contexto

El layout original era un grid 3×N secuencial con texto corrido por bloque. Se requiere un diseño fiel a la imagen de referencia del canvas empresarial: layout asimétrico con 2 filas y bloques de altura variable, estética sticky note, y un prompt que genere múltiples ideas cortas (una por línea) para que cada línea se renderice como tarjeta individual.

## MODIFIED

- **`CanvasGrid.tsx`**: layout `grid 3×N secuencial` → `grid-template-areas` asimétrico (2 filas, columnas con alturas variables). Los bloques se identifican por keyword en el título del paso (no por orden numérico). Etiquetas del canvas en vocabulario visual.
- **Renderizado de síntesis**: párrafo de texto corrido → sticky notes individuales (cada línea del resumen = una tarjeta de color con sombra suave).
- **Bloques vacíos**: skeleton animado → área visual en color tenue, siempre visible.
- **Prompt de síntesis**: `"Resume en máximo 4 líneas"` → `"Extrae 2 a 4 ideas clave. Escribe cada idea en una línea separada, sin viñetas ni numeración, máximo 15 palabras por idea."` El frontend divide por `\n` para renderizar cada línea como sticky note.
- **`SintetizarCanvasPorTokenUseCase`**: si la respuesta del paso está vacía o es `"(Sin respuesta registrada)"`, guardar string vacío en `CanvasBloque` sin llamar a OpenAI.

## ADDED

- **Generación del canvas al finalizar el último paso** (no al cargar la página de resultados): al hacer click en "Finalizar actividad", `RunnerPage` llama `POST /finalizar` y luego **aguarda** `POST /canvas` antes de mostrar la pantalla "¡Actividad completada!". El botón muestra "Preparando resultados..." durante la espera. Esto garantiza que el canvas esté listo cuando el participante llegue a `/resultados`, independientemente de si hace click en "Ver mis resultados".
- Bloque estático **"Recursos requeridos"** en el canvas visual — siempre vacío, no tiene paso en el taller.
- Mapeo título→posición:

| Paso (título contiene) | Etiqueta canvas | Posición grid |
|---|---|---|
| "Problema" | Problema o reto actual | Centro, tall (2 filas) |
| "Solución" | Oportunidad | Top izq-centro |
| "Datos" | Datos y fuentes | Izquierda, tall (2 filas) |
| "Usuarios" | Usuarios | Top der-centro |
| "Entregables" | Entregables | Bottom der-centro |
| "Actores" | Actores principales | Derecha, tall (2 filas) |
| "KPI" o "Indicador" | Indicadores de éxito | Bottom izq-centro |
| "Barrera" o "Riesgo" | Restricciones | Bottom izquierda, ancho |
| "Valor" o "Potencial" | Potencial de valor | Bottom derecha |
| *(estático)* | Recursos requeridos | Bottom centro |

## Criterios de aceptación

- [ ] El canvas visual muestra 2 filas con layout asimétrico (no grid uniforme)
- [ ] Bloques tall (Datos, Problema, Actores) ocupan el alto de 2 filas
- [ ] Cada idea generada por IA aparece como sticky note individual de color
- [ ] Bloques sin respuesta (Actores, Recursos) muestran área vacía visible, no skeleton
- [ ] "Recursos requeridos" aparece siempre vacío sin llamar a OpenAI
- [ ] Para bloques con respuesta vacía, no se hace llamada a OpenAI
- [ ] Al hacer click en "Finalizar actividad" en un Analytics Canvas, el botón muestra "Preparando resultados..." mientras se genera el canvas
- [ ] La pantalla "¡Actividad completada!" aparece solo después de que el canvas terminó de generarse
- [ ] Al llegar a /resultados el canvas ya está disponible sin spinner
