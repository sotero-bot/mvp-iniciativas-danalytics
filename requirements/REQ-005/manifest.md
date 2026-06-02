---
req_id: REQ-005
title: Distribución y supervisión de talleres
---

# Manifest — REQ-005

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/execution/interfaces/admin-execution.controller.ts` (CRUD instancias + listado + detalle + archivo-url)
- `apps/api/src/modules/execution/interfaces/admin-enlace.controller.ts`
- `apps/api/src/modules/execution/application/GenerarInstanciaUseCase.ts`
- `apps/api/src/modules/execution/application/GenerarEnlaceActividadUseCase.ts`
- `apps/api/src/modules/execution/application/IniciarSesionPorEnlaceUseCase.ts`
- `apps/api/src/modules/execution/application/ObtenerInstanciaDetalleUseCase.ts`
- `apps/api/src/modules/execution/application/use-cases.ts`
- `apps/api/src/modules/execution/domain/InstanciaActividad.ts`
- `apps/api/src/modules/execution/domain/IInstanciaRepository.ts`
- `apps/api/src/modules/execution/domain/EnlaceActividad.ts`
- `apps/api/src/modules/execution/domain/IEnlaceActividadRepository.ts`
- `apps/api/src/modules/execution/infrastructure/prisma/PrismaInstanciaRepository.ts`
- `apps/api/src/modules/execution/infrastructure/prisma/PrismaEnlaceActividadRepository.ts`
- `apps/api/src/modules/execution/infrastructure/prisma/InstanciaMapper.ts`
- `apps/api/src/modules/execution/interfaces/dtos/instancia-detalle-response.dto.ts`
- `apps/api/src/modules/execution/interfaces/dtos/index.ts`

### Frontend / UI

- `apps/web/src/features/execution/InstanciasPage.tsx`
- `apps/web/src/features/execution/InstanciaDetallePage.tsx`

### Base de datos

- `prisma/schema.prisma` (modelos `InstanciaActividad`, `EnlaceActividad`)

### Configuración

- `apps/api/src/app.module.ts` (providers de use-cases y repositorios)
