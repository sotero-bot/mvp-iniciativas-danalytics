---
req_id: REQ-002
title: Empresas, iniciativas y usuarios cliente
status: current
last_change: initial
---

# REQ-002 — Empresas, iniciativas y usuarios cliente: Estado consolidado actual

## Descripción

Catálogo jerárquico empresa → iniciativa → (actividad) + usuarios cliente por empresa. La empresa puede tener un PDF de contexto interno cuya extracción de texto se inyecta a los prompts de IA.

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- CRUD de empresas (incluye campos `sector`, `tipoOrganizacion`, `logoUrl`).
- Upload + borrado de PDF de contexto por empresa (texto plano persistido en BD).
- CRUD de iniciativas anidadas a empresa.
- CRUD de usuarios cliente con unicidad `(empresaId, email)`.
- Soft delete en cascada al borrar empresa.
- Import masivo de iniciativas + actividades + pasos + preguntas desde JSON para una empresa.

## Entidades de BD vigentes

- `Empresa`
- `Iniciativa`
- `Usuario`

## Interfaz vigente

Backend:
- `GET|POST /organization/empresas`, `PATCH|DELETE /organization/empresas/:id`
- `POST|DELETE /organization/empresas/:id/contexto-pdf`
- `GET|POST /organization/iniciativas`, `GET|PATCH|DELETE /organization/iniciativas/:id`
- `GET|POST /organization/usuarios`
- `POST /admin/import`

Frontend:
- `/admin/empresas`
- `/admin/iniciativas`
- ImportPage (componente, ruta no enlazada por defecto)

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
