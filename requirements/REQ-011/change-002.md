---
id: change-002
req_id: REQ-011
title: Precalentar síntesis Canvas al finalizar actividad
status: implementado
created: 2026-06-03
supersedes: change-001
---

# change-002 — Precalentar síntesis Canvas al finalizar actividad

## Contexto

En el flujo anterior, `POST /canvas` se disparaba al cargar `RunnerResultsPage`. Si la síntesis de OpenAI tardaba (hasta ~10s para 10 bloques), el participante veía un spinner en la página de resultados. Se decidió adelantar la llamada al momento en que el participante finaliza el último paso, para que la síntesis esté lista cuando llegue a la página de resultados.

## ADDED

- `RunnerPage` dispara `fetch(POST /execution/:token/canvas)` sin `await` (fire & forget) inmediatamente después de `POST /finalizar`, cuando `data.esCanvas` es `true`.

## MODIFIED

- Trigger de `POST /canvas`: "se llama únicamente al cargar `RunnerResultsPage`" → "se llama en `RunnerPage` al finalizar el último paso (primario, fire & forget) y en `RunnerResultsPage` como fallback; el backend tiene caché lazy y devuelve los bloques ya generados al instante en la segunda llamada"

## Entidades de BD afectadas

Ninguna. El backend ya tiene `@@unique([instanciaId, pasoId])` en `CanvasBloque` que actúa como caché.

## Criterios de aceptación

- [ ] Al hacer click en "Finalizar actividad" en el último paso de un Analytics Canvas, se dispara `POST /canvas` en background
- [ ] La pantalla "¡Actividad completada!" aparece sin esperar a que termine la síntesis
- [ ] Al navegar a `/resultados`, el canvas aparece sin spinner (o con spinner mínimo si OpenAI no terminó aún)
- [ ] Para actividades que no son Analytics Canvas, el comportamiento no cambia
