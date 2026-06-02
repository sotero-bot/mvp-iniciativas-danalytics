---
req_id: REQ-007
title: Asistencia IA contextual en pasos
status: current
last_change: initial
---

# REQ-007 — Asistencia IA contextual en pasos: Estado consolidado actual

## Descripción

Integración con OpenAI que enriquece cada paso con asistente IA contextual. Inyecta nombre de empresa + PDF de contexto al system prompt; el participante recibe la respuesta y la persiste como `respuestaIa`.

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- Consulta IA por paso vía `POST /execution/:token/ia` con respuesta usuario y archivo opcional.
- Construcción de system prompt con contexto de empresa (nombre + PDF truncado a 8K).
- Override del prompt vía `customPrompt` del cliente (usado para prompts a nivel pregunta servidos desde S3).
- Modo automático: si no hay input del usuario, se envía un placeholder explícito a OpenAI.
- Limpieza de archivos temporales y logging de uso.
- Resolución de prompts en S3 al cargar el runner (mapa `preguntaId → promptIaInline`).

## Entidades de BD vigentes

- `PasoActividad` (campos `usarIa`, `promptIa`, `iaAutomatica`)
- `PreguntaActividad` (campos análogos, parcialmente conectados al flujo)
- `Empresa` (campos `nombre`, `contextoPdfTexto`)
- `Interaccion` / `Respuesta` (persistencia del campo `respuestaIa`)

## Interfaz vigente

Backend:
- `POST /execution/:token/ia` (multipart)
- Lectura inline de prompts S3 dentro de `GET /execution/:token`.

Frontend:
- Panel de IA en `RunnerPage`.
- Footer global con disclaimer (`AiDisclaimerFooter` en `App.tsx`).

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
