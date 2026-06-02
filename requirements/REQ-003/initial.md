---
id: REQ-003
title: Plantillas metodológicas reutilizables
status: current
created: 2026-06-02
source: reverse-engineered
---

# Plantillas metodológicas reutilizables

## Contexto

El MVP incluye dos talleres estandarizados ("Mapa de Oportunidades de IA" y "Analytics Canvas"), pero el sistema está diseñado para que el consultor pueda añadir nuevos talleres como plantillas reutilizables sin escribir código. Cada plantilla describe la estructura completa de un taller: pasos en orden, preguntas por paso, prompts de IA por pregunta, archivos de plantilla, archivos de ejemplo, etc. Cuando se crea una `Actividad` para una `Iniciativa`, se clona desde una plantilla.

## Objetivo

Mantener un catálogo de plantillas de actividad con CRUD completo sobre la plantilla, sus pasos y sus preguntas; permitir importación masiva de plantillas vía JSON; soportar carga de archivos de ejemplo (en S3) y de prompt-templates (en S3) referenciados por pregunta.

## Alcance actual

### Funcionalidades implementadas

- CRUD de plantillas (`nombre`, `descripcion`, `orden`).
- CRUD de pasos de una plantilla (con `titulo`, `objetivo`, `instrucciones`, `ejemploKey` en S3).
- CRUD de preguntas de un paso (con `enunciado`, `permitirArchivo`, `soloArchivo`, `subirArchivoS3`, `usarIa`, `iaAutomatica`, `promptIa`, `urlPlantilla`, `urlPromptTemplate`).
- Presigned PUT URL para subir archivo de prompt-template de una pregunta a S3.
- Presigned GET URL para descargar dicho prompt-template.
- Borrado del prompt-template asociado a una pregunta.
- Import masivo `POST /admin/plantillas/import`: crea N plantillas con sus pasos y preguntas en una transacción.
- Bridge de compatibilidad con formato legacy (flags `usarIa`/`promptIa`/etc. a nivel paso se traducen a una pregunta única).
- Soft delete de plantilla en cascada (desactiva pasos y preguntas).
- Ordenamiento explícito de plantillas (`orden`) — usado para detectar "plantilla anterior" (ver REQ-006).

### Entidades de base de datos

- `PlantillaActividad(id, nombre, descripcion?, orden?, activo, timestamps)`
- `PasoPlantilla(id, plantillaId, titulo, objetivo?, instrucciones?, usarIa, iaAutomatica, promptIa?, permitirArchivo, soloArchivo, urlPlantilla?, ejemploKey?, orden, activo, timestamps)` con `@@unique([plantillaId, orden])`
- `PreguntaPlantilla(id, pasoId, orden, enunciado, permitirArchivo, soloArchivo, subirArchivoS3, usarIa, iaAutomatica, promptIa?, urlPlantilla?, urlPromptTemplate?, activo, timestamps)` con `@@unique([pasoId, orden])`

### Interfaz expuesta

Backend:
- `GET|POST /admin/plantillas`, `PUT|DELETE /admin/plantillas/:id`
- `POST /admin/plantillas/import`
- `GET|POST /admin/plantillas/:plantillaId/pasos`, `PUT|DELETE /admin/plantillas/:plantillaId/pasos/:pasoId`
- `GET|POST /admin/plantillas/:plantillaId/pasos/:pasoId/preguntas`
- `PUT|DELETE /admin/plantillas/:plantillaId/pasos/:pasoId/preguntas/:preguntaId`
- `POST .../preguntas/:preguntaId/presign-prompt` (PUT URL S3)
- `PATCH|DELETE .../preguntas/:preguntaId/prompt-template`
- `GET .../preguntas/:preguntaId/prompt-url` (GET URL S3)

Frontend:
- `/admin/plantillas` — listado y CRUD de plantillas
- `/admin/plantillas/:id/pasos` — editor de pasos y preguntas

## Restricciones conocidas

- Los flags `usarIa`/`iaAutomatica`/`promptIa` viven duplicados en paso y pregunta por compatibilidad con el formato legacy de import. El runner aún lee del paso en algunos lugares (ver REQ-007 y comentario `TODO(IA-por-pregunta)` en `ConsultarIaPorTokenUseCase`).
- Las plantillas se clonan a `Actividad` en el momento de crear la actividad — cambios posteriores en la plantilla NO se propagan a actividades existentes.
- `urlPromptTemplate` admite dos formatos: una key S3 (no empieza con `/`, se descarga al cargar el runner) o una URL local pública (empieza con `/`, tipo `/templates/x.md`).
