---
req_id: REQ-006
title: Runner del participante
status: current
last_change: initial
---

# REQ-006 — Runner del participante: Estado consolidado actual

## Descripción

Aplicación pública (sin auth) por la que el participante ejecuta el taller paso a paso, sube archivos, consulta a la IA y finaliza. Carga el contexto inicial (instancia + pasos + respuestas previas + respuestas de plantilla anterior) en un solo round-trip y persiste cada respuesta on the fly.

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- Carga inicial completa con `GET /execution/:token`.
- Identificación opcional del participante (nombre, email, cargo, área) con dedupe por `(empresaId, email)`.
- Inicio y finalización del taller con timestamps.
- Registro de respuesta por paso o por pregunta (texto + archivo).
- Extracción de texto de archivos (Excel → Markdown, PDF/Word → texto plano).
- Subida del archivo binario a S3 cuando la pregunta lo requiere (`subirArchivoS3`).
- Consulta a IA por paso (REQ-007) con respuesta visible al instante.
- Generación de Excel pre-rellenado con respuesta de IA para el taller "Mapa de Oportunidades".
- Carga de respuestas de la plantilla anterior cuando la actividad viene de una plantilla con `orden > 1`.
- Descarga del archivo de ejemplo del paso.
- Descarga del archivo de respuesta de una pregunta.
- Página de resultados al finalizar.

## Entidades de BD vigentes

- `InstanciaActividad` (consumida)
- `Interaccion` (granularidad por paso — legacy, aún en uso)
- `Respuesta` (granularidad por pregunta — modelo principal nuevo)
- `Usuario` (asociado/creado al identificarse)

## Interfaz vigente

Backend (`/execution/*`):
- `GET /execution/:token`
- `POST /execution/:token/iniciar`
- `POST /execution/:token/responder` (multipart)
- `POST /execution/:token/ia` (multipart)
- `POST /execution/:token/finalizar`
- `POST /execution/:token/identificar`, `GET /execution/:token/usuario`
- `POST /execution/:token/plantilla-prefilled/:pasoId`
- `POST /execution/:token/presign-ejemplo`
- `GET /execution/:token/pasos/:pasoId/ejemplo-url`
- `GET /execution/:token/respuestas/:preguntaId/archivo-url`

Frontend:
- `/runner/:token`
- `/runner/enlace/:token`
- `/runner/:token/resultados`

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
