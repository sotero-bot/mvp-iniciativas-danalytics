---
req_id: REQ-001
title: Autenticación administrativa
---

# Manifest — REQ-001

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/application/auth.service.ts`
- `apps/api/src/modules/auth/infrastructure/auth.controller.ts`
- `apps/api/src/modules/auth/infrastructure/local.strategy.ts`
- `apps/api/src/modules/auth/infrastructure/jwt.strategy.ts`

### Frontend / UI

- `apps/web/src/features/auth/LoginPage.tsx`
- `apps/web/src/App.tsx` (componente `AdminRoute` y manejo de `admin_token`)

### Base de datos

- `prisma/schema.prisma` (model `Admin`)

### Configuración

- `package.json` (script `seed:admin`)
