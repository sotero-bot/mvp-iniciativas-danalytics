---
req_id: REQ-007
title: Asistencia IA contextual en pasos
---

# Manifest — REQ-007

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/execution/application/ConsultarIaPorTokenUseCase.ts` (núcleo IA)
- `apps/api/src/modules/execution/interfaces/execution.controller.ts` (endpoint `/ia` y `resolverPromptsS3`)
- `apps/api/src/shared/utils/extractTextFromFile.ts` (extracción de contenido del archivo adjunto)

### Frontend / UI

- `apps/web/src/features/execution/RunnerPage.tsx` (panel de IA, botón "Consultar IA")
- `apps/web/src/App.tsx` (footer `AiDisclaimerFooter`)
- `apps/web/public/templates/analytics_canvas_prompt.md` (prompt-template del taller Analytics Canvas)

### Base de datos

- `prisma/schema.prisma` (campos `usarIa`/`promptIa`/`iaAutomatica` en `PasoActividad` y `PreguntaActividad`, `contextoPdfTexto` en `Empresa`, `respuestaIa` en `Interaccion`/`Respuesta`)

### Configuración

- Variables de entorno: `OPENAI_API_KEY`, `OPENAI_MODEL` (la última se lee desde `docs/tech-stack.md` pero el código actual hardcodea `gpt-4o`)
- `apps/api/src/app.module.ts` (provider `ConsultarIaPorTokenUseCase`)
