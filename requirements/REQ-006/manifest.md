---
req_id: REQ-006
title: Runner del participante
---

# Manifest — REQ-006

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/execution/interfaces/execution.controller.ts`
- `apps/api/src/modules/execution/application/AccederInstanciaPorTokenUseCase.ts`
- `apps/api/src/modules/execution/application/IniciarInstanciaPorTokenUseCase.ts`
- `apps/api/src/modules/execution/application/RegistrarRespuestaPorTokenUseCase.ts`
- `apps/api/src/modules/execution/application/RegistrarRespuestaUseCase.ts`
- `apps/api/src/modules/execution/application/FinalizarInstanciaPorTokenUseCase.ts`
- `apps/api/src/modules/execution/application/FinalizarInstanciaUseCase.ts`
- `apps/api/src/modules/execution/application/AsignarUsuarioPorTokenUseCase.ts`
- `apps/api/src/modules/execution/application/IniciarInstanciaUseCase.ts`
- `apps/api/src/modules/execution/interfaces/dtos/index.ts` (DTOs runner/iniciar/finalizar/respuesta)
- `apps/api/src/shared/utils/extractTextFromFile.ts`
- `apps/api/src/shared/utils/excelToMarkdown.ts`
- `apps/api/src/shared/utils/parseTableFromContent.ts`

### Frontend / UI

- `apps/web/src/features/execution/RunnerPage.tsx`
- `apps/web/src/features/execution/EnlaceRunnerPage.tsx`
- `apps/web/src/features/execution/RunnerResultsPage.tsx`
- `apps/web/src/features/execution/buildResumenHtml.ts`
- `apps/web/src/components/WysiwygEditor.tsx`
- `apps/web/src/components/Toast.tsx`
- `apps/web/src/components/ConfirmModal.tsx`
- `apps/web/src/App.tsx` (rutas `/runner/*` y `AiDisclaimerFooter`)
- `apps/web/public/templates/plantilla-priorizacion-mapa-oportunidades.xlsx`
- `apps/web/public/templates/analytics_canvas_prompt.md`

### Base de datos

- `prisma/schema.prisma` (modelos `Interaccion`, `Respuesta`)
- `prisma/migrations/20260526000000_add_contenido_archivo_to_interaccion/`

### Configuración

- `apps/api/src/app.module.ts` (registro de `ExecutionController` y use-cases asociados)
