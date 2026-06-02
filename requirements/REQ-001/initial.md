---
id: REQ-001
title: Autenticación administrativa
status: current
created: 2026-06-02
source: reverse-engineered
---

# Autenticación administrativa

## Contexto

El consultor de danalytics necesita ingresar a la consola interna para configurar talleres, supervisar respuestas y generar entregables. El acceso debe estar protegido por credenciales propias, separado del flujo público del participante (que entra por enlace sin autenticación).

## Objetivo

Permitir que los administradores autorizados inicien sesión con usuario y contraseña, obtengan un JWT y lo usen para acceder a los endpoints `/admin/*` y las páginas protegidas del frontend.

## Alcance actual

### Funcionalidades implementadas

- Login con usuario + contraseña vía estrategia Passport `local`.
- Emisión de JWT al validar credenciales.
- Estrategia Passport `jwt` para validar tokens en endpoints protegidos.
- Endpoint `GET /auth/profile` que devuelve los datos del admin autenticado.
- Persistencia del token en `localStorage` del navegador (key `admin_token`).
- Página de login en frontend (`/login`) y guardia `AdminRoute` que redirige al login si no hay token.
- Cierre de sesión con borrado del token y vuelta al login.
- Seed automático del admin inicial al hacer build en Vercel (`npm run seed:admin`).
- Hash de contraseña con bcrypt al sembrar el admin.

### Entidades de base de datos

- `Admin` — id, username (único), nombre, password (hash bcrypt), activo, timestamps.

### Interfaz expuesta

- `POST /auth/login` — recibe `{username, password}`, devuelve `{access_token}`.
- `GET /auth/profile` — devuelve datos del admin del JWT presente en el header.
- Página frontend `/login`.

## Restricciones conocidas

- Único rol soportado: admin global. No hay multi-tenancy ni control granular de permisos.
- Recuperación de contraseña no implementada — la única vía para restablecer es regenerar el seed.
- El token vive en `localStorage`; no hay refresh tokens ni expiración manejada por el cliente más allá del expiry del JWT.
