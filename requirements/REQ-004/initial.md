---
id: REQ-004
title: Configuración de actividades por iniciativa
status: current
created: 2026-06-02
source: reverse-engineered
---

# Configuración de actividades por iniciativa

## Contexto

Una vez existe la empresa y la iniciativa, el consultor crea las actividades concretas que se ejecutarán: cada actividad es la "instancia editable" del taller para esa iniciativa. Puede partir de una plantilla (clonada en el momento de la creación) o crearse vacía y configurarse paso a paso. Esta es la entidad que los participantes ejecutarán a través del runner.

## Objetivo

Permitir al consultor crear, editar y eliminar actividades asociadas a una iniciativa, gestionar sus pasos y preguntas, y enriquecer cada paso/pregunta con prompts de IA, archivos de ejemplo en S3 y archivos de prompt-template.

## Alcance actual

### Funcionalidades implementadas

- CRUD de actividades (`GET|POST|PUT|DELETE /methodology/actividades`).
- Creación de actividad desde plantilla (`plantillaId` en el body → clona plantilla con sus pasos y preguntas).
- Creación de actividad vacía (sin plantilla).
- Listado de actividades con anidamiento `actividad → iniciativa → empresa` y `plantillaOrigen`.
- Filtrado por `iniciativaId` en query.
- CRUD de pasos de una actividad (`GET|POST|PUT|DELETE /admin/actividades/:id/pasos`).
- CRUD de preguntas de un paso de actividad (`GET|POST|PUT|DELETE /admin/actividades/:id/pasos/:pasoId/preguntas`).
- Carga de archivo de ejemplo por paso vía presigned PUT URL S3 (`presign-ejemplo`).
- Borrado del archivo de ejemplo.
- Carga de prompt-template por pregunta vía presigned PUT URL S3 (`presign-prompt`).
- Borrado del prompt-template.
- Soft delete en cascada (instancias + pasos + actividad).
- Importación masiva de actividades + pasos + preguntas para una empresa (`POST /admin/import`, ver REQ-002).

### Entidades de base de datos

- `Actividad(id, nombre, descripcion?, estado, iniciativaId, plantillaOrigenId?, activo, timestamps)`
- `PasoActividad(id, actividadId, titulo, objetivo?, instrucciones?, promptIa?, usarIa, iaAutomatica, permitirArchivo, soloArchivo, urlPlantilla?, ejemploKey?, orden, activo, timestamps)` con `@@unique([actividadId, orden])`
- `PreguntaActividad(id, pasoId, orden, enunciado, permitirArchivo, soloArchivo, subirArchivoS3, usarIa, iaAutomatica, promptIa?, urlPlantilla?, urlPromptTemplate?, activo, timestamps)` con `@@unique([pasoId, orden])`

### Interfaz expuesta

Backend:
- `GET|POST|PUT|DELETE /methodology/actividades[/:id]`
- `GET|POST /admin/actividades/:id/pasos`
- `PUT|DELETE /admin/actividades/:id/pasos/:pasoId`
- `POST /admin/actividades/:id/pasos/:pasoId/presign-ejemplo`
- `GET /admin/actividades/:id/pasos/:pasoId/ejemplo-url`
- `DELETE /admin/actividades/:id/pasos/:pasoId/ejemplo`
- `GET|POST /admin/actividades/:id/pasos/:pasoId/preguntas`
- `PUT|DELETE /admin/actividades/:id/pasos/:pasoId/preguntas/:preguntaId`
- `POST /admin/actividades/:id/pasos/:pasoId/preguntas/:preguntaId/presign-prompt`
- `PATCH|DELETE /admin/actividades/:id/pasos/:pasoId/preguntas/:preguntaId/prompt-template`
- `GET /admin/actividades/:id/pasos/:pasoId/preguntas/:preguntaId/prompt-url`

Frontend:
- `/admin/actividades` — listado y CRUD anidado a iniciativa
- `/admin/actividades/:id/pasos` — editor de pasos y preguntas

## Restricciones conocidas

- El campo `estado` de la actividad (`inactiva` por defecto) está presente en la BD pero no se usa activamente desde controladores; el estado real del taller vive en `InstanciaActividad`.
- El clonado plantilla → actividad es un snapshot: no se vuelve a sincronizar si la plantilla cambia.
- Los flags `usarIa`/`iaAutomatica`/`promptIa` están duplicados entre paso y pregunta (ver REQ-003 sobre legacy/bridge).
