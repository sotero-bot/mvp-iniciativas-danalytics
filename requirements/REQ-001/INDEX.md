---
req_id: REQ-001
title: Autenticación administrativa
status: current
last_change: initial
---

# REQ-001 — Autenticación administrativa: Estado consolidado actual

## Descripción

Autenticación con usuario + contraseña + JWT para el rol admin (consultor danalytics) que opera la consola interna. Los participantes del taller NO usan este flujo (entran por enlace público sin auth).

## Estado de implementación

**Implementado completamente.** Documentado por ingeniería inversa el 2026-06-02.

## Funcionalidades vigentes

- Login `POST /auth/login` con `username` + `password`; devuelve JWT.
- Validación de JWT en endpoints protegidos vía `AuthGuard('jwt')`.
- `GET /auth/profile` retorna el usuario autenticado del token.
- Frontend persiste el token en `localStorage` y lo añade a los headers de las llamadas a `/admin/*`.
- Guardia `AdminRoute` en React redirige a `/login` si no hay token.
- Seed inicial del admin (`admin`/`dax1973*`) en cada build de Vercel.
- Hash de contraseña con bcrypt (rounds=10).

## Entidades de BD vigentes

- `Admin(id, username @unique, nombre, password, activo, createdAt, updatedAt)`

## Interfaz vigente

- `POST /auth/login`
- `GET /auth/profile`
- Página frontend: `/login`

## Historial de cambios

| Change  | Descripción                                  | Estado  |
| ------- | -------------------------------------------- | ------- |
| initial | Documentación inicial por ingeniería inversa | current |
