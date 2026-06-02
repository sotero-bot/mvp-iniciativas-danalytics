---
req_id: REQ-005
title: Distribución y supervisión de talleres
status: implementado
last_change: change-001
---

# REQ-005 — Distribución y supervisión de talleres: Estado consolidado actual

## Descripción

Generación y gestión de instancias y enlaces de acceso para distribuir actividades a los participantes, más el panel de supervisión donde el consultor ve el estado y las respuestas de cada instancia, con capacidad de filtrado por empresa y actividad.

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02. Actualizado con filtros globales el 2026-06-02 (change-001).

## Funcionalidades vigentes

- Generar instancias 1-a-1 con email opcional.
- Generar enlaces permanentes multi-persona que crean instancias on-demand.
- Listar, detallar y eliminar (soft) instancias y enlaces.
- Token de acceso único por instancia y por enlace.
- Vista admin con tabla de instancias + tabla de enlaces, copia de enlace y borrado.
- Vista admin de detalle por instancia con respuestas, archivos y enlace a descargas (REQ-009).
- **Filtros globales** por empresa y actividad en la página de instancias (`/admin/instancias`), que aplican a ambas tablas (Enlaces Activos y Ejecuciones Individuales). Opciones derivadas dinámicamente de los datos reales.

## Entidades de BD vigentes

- `InstanciaActividad`
- `EnlaceActividad`

## Interfaz vigente

Backend:
- `POST /admin/instancias/generar`
- `GET /admin/instancias`, `GET /admin/instancias/:id`
- `DELETE /admin/instancias/:id`
- `GET /admin/instancias/:id/respuestas/:preguntaId/archivo-url`
- `POST /admin/enlaces/generar`, `GET /admin/enlaces`, `DELETE /admin/enlaces/:id`
- `POST /execution/enlace/:token/sesion`

Frontend:
- `/admin/instancias`
- `/admin/instancias/:id`

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | archived |
| change-001 | Añadidos filtros globales (empresa/actividad) | implementado |
