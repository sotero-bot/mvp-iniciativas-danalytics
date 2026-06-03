---
id: change-001
req_id: REQ-007
title: Eliminar adjunto de archivo en consulta IA
status: aprobado
created: 2026-06-03
supersedes: initial
---

# change-001 — Eliminar adjunto de archivo en consulta IA

## Contexto

El bloque "Adjuntar archivo" en preguntas con IA no automática permitía al participante adjuntar PDF, Word o Excel para que la IA los procesara. Se decidió eliminar esta funcionalidad del cliente: la consulta IA solo acepta texto como input del participante.

## MODIFIED

- "Consulta IA por paso con respuesta usuario y archivo opcional" → "Consulta IA por paso con respuesta de texto del usuario (sin adjunto de archivo)"
- Validación del botón "Consultar IA": antes aceptaba archivo como sustituto de texto → ahora solo habilita el botón cuando hay texto escrito

## REMOVED

- Bloque UI "Adjuntar archivo" en preguntas con `usarIa && !iaAutomatica` (etiqueta PDF, Word, Excel — máx. 10 MB, selector de archivo, botón quitar)
- Estado `archivosIa: Record<string, File | null>` en `RunnerPage`
- Envío del campo `archivo` en el `FormData` del `POST /execution/:token/ia` desde el cliente
- Reset de `archivosIa` al avanzar/retroceder paso

## Entidades de BD afectadas

Ninguna. El backend sigue aceptando `archivo` en el multipart (no se rompe), simplemente el cliente ya no lo envía.

## Criterios de aceptación

- [ ] En preguntas con IA no automática, no aparece el bloque "Adjuntar archivo"
- [ ] El botón "Consultar IA" se habilita únicamente cuando hay texto escrito en la respuesta
- [ ] La consulta IA funciona correctamente sin archivo adjunto
