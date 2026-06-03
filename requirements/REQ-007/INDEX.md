---
req_id: REQ-007
title: Asistencia IA contextual en pasos
status: implementado
current_state: change-001
---

# REQ-007 — Asistencia IA contextual en pasos: Estado consolidado actual

## Descripción

Integración con OpenAI que enriquece cada paso con asistente IA contextual. Inyecta nombre de empresa + PDF de contexto al system prompt; el participante recibe la respuesta y la persiste como `respuestaIa`.

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02. Actualizado el 2026-06-03 (change-001): eliminado adjunto de archivo en consulta IA.

## Funcionalidades vigentes

- Consulta IA por paso vía `POST /execution/:token/ia` con respuesta de texto del usuario (sin adjunto de archivo desde el cliente).
- Construcción de system prompt con contexto de empresa (nombre + PDF truncado a 8K).
- Override del prompt vía `customPrompt` del cliente (usado para prompts a nivel pregunta servidos desde S3).
- Modo automático: si no hay input del usuario, se envía un placeholder explícito a OpenAI.
- Limpieza de archivos temporales y logging de uso.
- Resolución de prompts en S3 al cargar el runner (mapa `preguntaId → promptIaInline`).
- El botón "Consultar IA" solo se habilita cuando hay texto escrito en la respuesta (no acepta archivo como sustituto).

## Entidades de BD vigentes

- `PasoActividad` (campos `usarIa`, `promptIa`, `iaAutomatica`)
- `PreguntaActividad` (campos análogos, parcialmente conectados al flujo)
- `Empresa` (campos `nombre`, `contextoPdfTexto`)
- `Interaccion` / `Respuesta` (persistencia del campo `respuestaIa`)

## Interfaz vigente

Backend:
- `POST /execution/:token/ia` (multipart — el campo `archivo` sigue aceptándose en el backend aunque el cliente ya no lo envía)
- Lectura inline de prompts S3 dentro de `GET /execution/:token`.

Frontend:
- Panel de IA en `RunnerPage` (sin bloque "Adjuntar archivo").
- Footer global con disclaimer (`AiDisclaimerFooter` en `App.tsx`).

## Historial de cambios

| Change     | Descripción                                          | Estado     |
| ---------- | ---------------------------------------------------- | ---------- |
| initial    | Documentación inicial por ingeniería inversa         | archived   |
| change-001 | Eliminar adjunto de archivo en consulta IA           | implementado |
