---
id: change-002
req_id: REQ-007
title: Cadena de fallback de prompts y visibilidad en runner
status: implementado
created: 2026-06-04
supersedes: change-001
---

# change-002 — Cadena de fallback de prompts y visibilidad en runner

## Contexto

Antes, el runner leía el prompt únicamente desde `PreguntaActividad.urlPromptTemplate`. Esto impedía reutilizar prompts configurados en la plantilla origen. Adicionalmente, los archivos `.md` estáticos en `/templates/` eran resueltos por el frontend con un `fetch`, generando una segunda petición innecesaria. Se añade visibilidad del prompt interpolado en el runner para facilitar pruebas.

## MODIFIED

### Backend — `execution.controller.ts`

- **`GET /execution/:token`** — la query ahora incluye `plantillaOrigen.pasos.preguntas` para acceder a los prompts de la plantilla origen.
- **Cadena de fallback de `urlPromptTemplate`** (prioridad descendente):
  1. S3 de la actividad (`PreguntaActividad.urlPromptTemplate` que no inicia con `/`)
  2. S3 de la plantilla (`PreguntaPlantilla.urlPromptTemplate` que no inicia con `/`), matched por `(paso.orden, pregunta.orden)`
  3. Path estático de la actividad (inicia con `/`)
  4. Path estático de la plantilla (inicia con `/`)
- **Cadena de fallback de `promptIa`** (inline text):
  1. `PreguntaActividad.promptIa`
  2. `PreguntaPlantilla.promptIa` matched por orden
  3. `PasoActividad.promptIa`
  4. `PasoPlantilla.promptIa` matched por orden
- **`resolverPromptsS3`** — ahora resuelve ambos tipos de key a contenido inline (`promptIaInline`):
  - Keys S3 (no inician con `/`): descarga del bucket.
  - Paths estáticos (inician con `/`): lee desde `apps/web/public` en el filesystem del servidor.
  - El frontend ya no necesita hacer `fetch` adicionales para templates.

### Admin — `ActividadPasosPage.tsx`

- **Campo "Prompt IA" en edición de pregunta de actividad** — deja de ser obligatorio (`required` eliminado). Label actualizado: "opcional — si está vacío se usa el de la plantilla". El fallback al prompt de la plantilla lo cubre el backend.

### Frontend — `RunnerPage.tsx`

- **Sección "Ver prompt base"** — visible en toda pregunta con `usarIa: true`. Muestra el prompt ya interpolado (`customPrompts[pregunta.id]`), con fallback a texto crudo si aún no fue interpolado, o el mensaje `(sin prompt configurado — el servidor usa el predeterminado)` si no hay ninguno.
- **`loadData`** — las llamadas a `interpolarPrompt` ahora incluyen `usuario: { area, cargo }` tomado de `json.usuario` (usuario registrado) para poblar `{{idenForm.area}}` y `{{idenForm.cargo}}` desde el inicio de sesión.

## Decisiones de diseño

- **Prioridad S3 > estático**: un archivo subido explícitamente a S3 siempre gana sobre el template genérico en `/templates/`, incluso si la actividad tiene configurado el path estático por defecto.
- **Resolución server-side**: mover la lectura de archivos estáticos al backend elimina la dependencia del frontend en rutas públicas y centraliza toda la resolución en `resolverPromptsS3`.
- **Fallback de `promptIa` por orden**: no existe FK entre `PreguntaActividad` y `PreguntaPlantilla`; el match se hace por `(paso.orden, pregunta.orden)`, que es estable mientras no se reordenen los pasos.
