---
req_id: REQ-003
title: Plantillas metodológicas reutilizables
---

# Manifest — REQ-003

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/methodology/interfaces/admin-plantillas.controller.ts`
- `apps/api/src/modules/methodology/interfaces/admin-plantilla-pasos.controller.ts`
- `apps/api/src/modules/methodology/application/InstanciarPlantillaUseCase.ts` (clonado plantilla → actividad)

### Frontend / UI

- `apps/web/src/features/methodology/PlantillasPage.tsx`
- `apps/web/src/features/methodology/PlantillaPasosPage.tsx`
- `apps/web/src/components/PromptTemplateField.tsx` (uploader presigned para prompts)
- `apps/web/src/components/WysiwygEditor.tsx` (editor enunciado/objetivo)

### Base de datos

- `prisma/schema.prisma` (modelos `PlantillaActividad`, `PasoPlantilla`, `PreguntaPlantilla`)
- `prisma/migrations/20260528000001_add_url_prompt_template_to_preguntas/`
- `prisma/migrations/20260528000002_add_subir_archivo_s3/`

### Configuración

- `apps/api/src/app.module.ts` (registro de controllers `AdminPlantillasController`, `AdminPlantillaPasosController`)
