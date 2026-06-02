---
req_id: REQ-004
title: Configuración de actividades por iniciativa
---

# Manifest — REQ-004

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/methodology/interfaces/actividades.controller.ts`
- `apps/api/src/modules/methodology/interfaces/admin-actividades.controller.ts`
- `apps/api/src/modules/methodology/application/AgregarPasoActividadUseCase.ts`
- `apps/api/src/modules/methodology/application/ObtenerPasosActividadUseCase.ts`
- `apps/api/src/modules/methodology/application/InstanciarPlantillaUseCase.ts`
- `apps/api/src/modules/methodology/domain/Actividad.ts`
- `apps/api/src/modules/methodology/domain/PasoActividad.ts`
- `apps/api/src/modules/methodology/domain/IPasoActividadRepository.ts`
- `apps/api/src/modules/methodology/infrastructure/PrismaActividadRepository.ts`
- `apps/api/src/modules/methodology/infrastructure/PrismaPasoActividadRepository.ts`
- `apps/api/src/modules/methodology/interfaces/dtos/agregar-paso.dto.ts`
- `apps/api/src/modules/methodology/interfaces/dtos/paso-actividad-response.dto.ts`

### Frontend / UI

- `apps/web/src/features/methodology/ActividadesPage.tsx`
- `apps/web/src/features/methodology/ActividadPasosPage.tsx`
- `apps/web/src/components/PromptTemplateField.tsx`
- `apps/web/src/components/WysiwygEditor.tsx`

### Base de datos

- `prisma/schema.prisma` (modelos `Actividad`, `PasoActividad`, `PreguntaActividad`)
- `prisma/migrations/20260528000001_add_url_prompt_template_to_preguntas/`
- `prisma/migrations/20260528000002_add_subir_archivo_s3/`

### Configuración

- `apps/api/src/app.module.ts` (registro de controllers y providers de use-cases)
