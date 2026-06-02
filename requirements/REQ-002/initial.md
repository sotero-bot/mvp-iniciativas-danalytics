---
id: REQ-002
title: Empresas, iniciativas y usuarios cliente
status: current
created: 2026-06-02
source: reverse-engineered
---

# Empresas, iniciativas y usuarios cliente

## Contexto

Antes de poder ejecutar un taller, el consultor debe modelar el cliente: registrar la empresa, las iniciativas que la empresa quiere abordar y, opcionalmente, los usuarios (áreas/personas) que van a participar. Estos datos contextualizan los talleres y se usan para personalizar la asistencia IA (contexto interno de la empresa) y los entregables finales.

## Objetivo

Mantener un catálogo CRUD de empresas, iniciativas y usuarios cliente, con relación jerárquica empresa → iniciativa → actividad y soporte para cargar un PDF de contexto interno por empresa que la IA usa como referencia.

## Alcance actual

### Funcionalidades implementadas

- CRUD de empresas con campos `nombre`, `sector`, `tipoOrganizacion`, `logoUrl`.
- Subida de PDF de contexto interno por empresa: extracción de texto (PDF-parse) almacenada en BD para uso por la IA.
- Borrado de PDF de contexto.
- CRUD de iniciativas asociadas a una empresa (`nombre`, `descripcion`).
- Listado de iniciativas con anidamiento `iniciativa → empresa`.
- CRUD básico de usuarios cliente (`nombre`, `email`, `cargo`, `area`, `empresaId`).
- Unicidad de email por empresa (`empresa_email_unico`).
- Soft delete en cascada: al eliminar una empresa se desactivan iniciativas, actividades, pasos e instancias asociadas.
- Import masivo (`POST /admin/import`) que crea iniciativas + actividades + pasos + preguntas para una empresa desde un JSON.

### Entidades de base de datos

- `Empresa(id, nombre, sector?, tipoOrganizacion?, logoUrl?, contextoPdfNombre?, contextoPdfTexto?, contextoPdfActualizadoEn?, activo, timestamps)`
- `Iniciativa(id, nombre, descripcion?, empresaId, activo, timestamps)`
- `Usuario(id, nombre, email, cargo?, area?, empresaId, estado, activo, timestamps)` con `@@unique([empresaId, email])`

### Interfaz expuesta

Backend:
- `GET|POST /organization/empresas`, `PATCH|DELETE /organization/empresas/:id`
- `POST /organization/empresas/:id/contexto-pdf` y `DELETE` del mismo
- `GET|POST /organization/iniciativas`, `GET|PATCH|DELETE /organization/iniciativas/:id`
- `GET|POST /organization/usuarios`
- `POST /admin/import` (import masivo para una empresa)

Frontend:
- `/admin/empresas` — listado y CRUD con upload de PDF de contexto
- `/admin/iniciativas` — listado y CRUD anidado a empresa
- `/admin/importar` (ImportPage) — UI para el import masivo

## Restricciones conocidas

- Los usuarios cliente NO tienen autenticación: el `area`/`cargo` solo se captura para reportes; no inician sesión.
- El PDF de contexto se almacena como texto plano en BD (no como archivo en S3). Truncado a 8.000 caracteres al inyectarse al prompt.
- Solo se admite formato `.pdf` para el contexto de empresa; otros formatos son rechazados.
- La unicidad de email es por empresa, no global — el mismo email puede existir en empresas distintas.
