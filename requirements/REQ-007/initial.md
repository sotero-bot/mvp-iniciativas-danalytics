---
id: REQ-007
title: Asistencia IA contextual en pasos
status: superseded
superseded_by: change-001
created: 2026-06-02
source: reverse-engineered
---

> ⚠️ **ESTADO HISTÓRICO.** Superseded by change-001. El estado vigente vive en `INDEX.md`. NO usar como fuente de verdad.

# Asistencia IA contextual en pasos

## Contexto

Uno de los diferenciadores del producto: cada paso del taller (cuando está marcado como `usarIa`) ofrece al participante un asistente IA que toma su respuesta y la transforma o enriquece según un `promptIa` configurable. La asistencia es contextual a la empresa: se inyecta el nombre y, opcionalmente, el texto extraído de un PDF de contexto interno de la empresa (REQ-002). Hay dos modos: asistido (el usuario escribe, la IA refina) y automático (la IA genera todo siguiendo el prompt, sin texto del usuario).

## Objetivo

Permitir al participante consultar la IA desde un paso del runner, recibiendo una respuesta personalizada que considera (a) el prompt configurado para el paso, (b) el contexto de la empresa cliente, y (c) opcionalmente el contenido de un archivo adjunto.

## Alcance actual

### Funcionalidades implementadas

- Endpoint `POST /execution/:token/ia` que recibe `pasoId`, `respuesta` y opcionalmente `customPrompt` y un `archivo` (multipart).
- Lookup del paso para verificar `usarIa: true`; rechazo si está deshabilitado.
- Construcción del system prompt con:
  - Nombre de la empresa.
  - Texto del PDF de contexto interno (truncado a 8.000 caracteres).
  - Prompt base: `customPrompt` (override del cliente) ó `paso.promptIa` ó un default genérico.
- Construcción del user message con:
  - La `respuestaUsuario`.
  - El contenido extraído del archivo adjunto (truncado a 15.000 caracteres).
  - Un placeholder explícito cuando no hay input del usuario (modo `iaAutomatica`).
- Llamada a OpenAI con `model: gpt-4o` y `max_completion_tokens: 16384`.
- Limpieza del archivo temporal tras el procesamiento.
- Logging del modelo solicitado vs usado, `finish_reason` y `usage`.
- Manejo defensivo: si OpenAI falla, se devuelve `'Error al procesar la solicitud con IA'`.
- Resolución de prompts en S3 (`urlPromptTemplate`): en el `GET /execution/:token`, se descargan los prompts referenciados en S3 y se devuelven inline al runner para que pueda usarlos como `customPrompt`.

### Entidades de base de datos

- `PasoActividad` (consume `usarIa`, `promptIa`, `iaAutomatica`)
- `PreguntaActividad` (consume `usarIa`, `promptIa`, `urlPromptTemplate`, `iaAutomatica` — actualmente solo a través del bridge legacy del paso)
- `Empresa` (consume `nombre`, `contextoPdfTexto`)
- `Interaccion`/`Respuesta` (persistencia del resultado `respuestaIa`)

### Interfaz expuesta

Backend:
- `POST /execution/:token/ia` (multipart con `archivo` opcional)
- Resolución inline de prompts S3 dentro de `GET /execution/:token`.

Frontend:
- Panel de IA dentro de `RunnerPage` (botón "Consultar a la IA", spinner, render del resultado en Markdown).
- Footer global "el asistente usa IA y puede cometer errores" (`AiDisclaimerFooter`).

## Restricciones conocidas

- El modelo OpenAI está hardcodeado a `gpt-4o` en `ConsultarIaPorTokenUseCase` (la doc en `docs/constraints.md` dice que NO debe estarlo; pendiente de migrar a `process.env.OPENAI_MODEL`).
- La asistencia IA se lee del paso, NO de la pregunta. Hay un `TODO(IA-por-pregunta)` que documenta el rework pendiente para que cada pregunta tenga su propio prompt e independencia.
- El contexto de empresa solo inyecta hasta 8.000 caracteres del PDF; documentos más largos se truncan silenciosamente.
- Sin sistema de rate-limiting/quota a nivel aplicación — el costo de OpenAI depende del volumen de consultas.
- Sin reintentos automáticos ante fallas transitorias de OpenAI.
