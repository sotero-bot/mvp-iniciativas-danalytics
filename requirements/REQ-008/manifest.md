---
req_id: REQ-008
title: Almacenamiento de archivos en S3
---

# Manifest — REQ-008

## Archivos que implementan este REQ

### Backend / Lógica

- `apps/api/src/modules/storage/S3Service.ts`

### Base de datos

- `prisma/schema.prisma` (campos `archivoKey` en `Respuesta`, `ejemploKey` en `PasoActividad`/`PasoPlantilla`, `urlPromptTemplate` en `PreguntaActividad`/`PreguntaPlantilla`)

### Configuración

- Variables de entorno: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `apps/api/src/app.module.ts` (provider `S3Service`)
- `.claude/skills/s3-key-naming/` (convención de keys documentada como skill)
