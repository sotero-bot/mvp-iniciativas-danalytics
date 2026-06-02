---
id: REQ-005
title: Distribución y supervisión de talleres
status: current
created: 2026-06-02
source: reverse-engineered
---

# Distribución y supervisión de talleres

## Contexto

Cuando una actividad está configurada, el consultor necesita repartirla entre los participantes (áreas de la empresa cliente) y supervisar cómo avanzan en tiempo real. La plataforma soporta dos modalidades complementarias: instancias 1-a-1 generadas con un email de referencia, y enlaces permanentes multi-persona que crean una nueva instancia cada vez que alguien los abre. Una vez activos los talleres, el consultor accede a un panel donde ve cada instancia, su estado, las respuestas paso a paso y desde donde puede descargar entregables.

## Objetivo

Permitir al consultor (a) generar instancias e enlaces de acceso para una actividad, (b) listar y consultar el detalle de cada instancia, y (c) gestionar el ciclo de vida (eliminación lógica) de instancias y enlaces.

## Alcance actual

### Funcionalidades implementadas

**Instancias 1-a-1:**
- Generar instancia para una actividad con `emailReferencia` opcional (`POST /admin/instancias/generar`).
- Token de acceso único por instancia (`accessToken`).
- Listado paginado/global de todas las instancias con anidamiento `instancia → actividad → iniciativa → empresa`, `usuario`, interacciones y respuestas con archivos.
- Detalle de una instancia con pasos, preguntas, respuestas e interacciones (`GET /admin/instancias/:id`).
- Soft delete (`DELETE /admin/instancias/:id`).

**Enlaces multi-persona:**
- Generar enlace permanente por actividad (`POST /admin/enlaces/generar`).
- Listar enlaces activos (`GET /admin/enlaces`).
- Eliminar enlace (`DELETE /admin/enlaces/:id`).
- Resolución del enlace: cuando un participante abre el enlace, se crea una nueva `InstanciaActividad` con su token propio (`POST /execution/enlace/:token/sesion`).

**Frontend de supervisión:**
- Página `/admin/instancias` con tabla de instancias y enlaces, copia de enlace al portapapeles, generación de nuevas instancias y de nuevos enlaces.
- Página `/admin/instancias/:id` con detalle de respuestas paso a paso, descarga de archivos respuesta, generación de PDF/ZIP/Excel (delegado a REQ-009).

### Entidades de base de datos

- `InstanciaActividad(id, actividadId, usuarioId?, accessToken @unique, estado, emailReferencia?, activo, fechaInicio?, fechaFin?, timestamps)` — relaciona con `Interaccion[]` y `Respuesta[]`.
- `EnlaceActividad(id, actividadId, accessToken @unique, nombre?, activo, timestamps)`.

### Interfaz expuesta

Backend:
- `POST /admin/instancias/generar`, `GET /admin/instancias`, `GET /admin/instancias/:id`, `DELETE /admin/instancias/:id`
- `GET /admin/instancias/:id/respuestas/:preguntaId/archivo-url` (presigned GET del archivo de respuesta)
- `POST /admin/enlaces/generar`, `GET /admin/enlaces`, `DELETE /admin/enlaces/:id`
- `POST /execution/enlace/:token/sesion` (resuelve enlace → instancia nueva)

Frontend:
- `/admin/instancias` — listado, generación, copia de enlaces, borrado
- `/admin/instancias/:id` — detalle por instancia (incluye descargas, ver REQ-009)

## Restricciones conocidas

- Los enlaces NO expiran salvo borrado manual; cualquier persona con el enlace puede iniciar una nueva instancia.
- No hay envío automático de enlaces por email — el consultor copia el enlace y lo distribuye manualmente (ver `docs/constraints.md`).
- Las instancias 1-a-1 con `emailReferencia` se asocian a un participante específico; los enlaces multi-persona requieren que cada participante se identifique después de abrir el enlace.
- El listado `GET /admin/instancias` incluye datos pesados (respuestas con archivos) en un solo round-trip; no hay paginación todavía.
