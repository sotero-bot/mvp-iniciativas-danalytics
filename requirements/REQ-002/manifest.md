---
req_id: REQ-002
title: Empresas, iniciativas y usuarios cliente
---

# Manifest — REQ-002

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/organization/interfaces/empresas.controller.ts`
- `apps/api/src/modules/organization/interfaces/iniciativas.controller.ts`
- `apps/api/src/modules/organization/interfaces/usuarios.controller.ts`
- `apps/api/src/modules/organization/interfaces/admin-import.controller.ts`
- `apps/api/src/modules/organization/domain/Empresa.ts`
- `apps/api/src/shared/utils/extractTextFromFile.ts` (extracción de texto del PDF de contexto)

### Frontend / UI

- `apps/web/src/features/organization/EmpresasPage.tsx`
- `apps/web/src/features/organization/IniciativasPage.tsx`
- `apps/web/src/features/admin/ImportPage.tsx`

### Base de datos

- `prisma/schema.prisma` (modelos `Empresa`, `Iniciativa`, `Usuario`)
- `prisma/migrations/20260528000000_add_sector_tipo_organizacion_to_empresa/`
- `prisma/migrations/20260309184114_add_activo_field/` (incluye empresas/iniciativas)

### Configuración

- `apps/api/src/app.module.ts` (registro de controllers)
