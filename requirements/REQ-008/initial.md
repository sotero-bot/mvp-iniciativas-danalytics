---
id: REQ-008
title: Almacenamiento de archivos en S3
status: current
created: 2026-06-02
source: reverse-engineered
---

# Almacenamiento de archivos en S3

## Contexto

El stack corre en Vercel (stateless): no se puede confiar en el sistema de archivos local para nada persistente. Todos los archivos relevantes — plantillas de prompts, archivos de ejemplo por paso, archivos subidos por participantes como respuesta, etc. — viven en S3 (bucket `ia-gobernanza`). El sistema usa presigned URLs para evitar pasar bytes por el backend cuando es posible.

## Objetivo

Centralizar en un servicio reutilizable la integración con AWS S3 (SDK v3): subida directa, descarga directa, generación de presigned URLs (PUT y GET), borrado y una convención uniforme para generar `Key`s legibles y únicas dentro del bucket.

## Alcance actual

### Funcionalidades implementadas

- `S3Service` (NestJS provider) con cliente perezoso: si faltan variables de entorno, `isConfigured` es `false` y los endpoints S3 devuelven `BadRequestException('S3 no configurado')`.
- `uploadFile(key, filePath, contentType)` — sube desde archivo temporal en disco.
- `getPresignedPutUrl(key, contentType, expiresIn=300)` — para uploads directos browser→S3.
- `getPresignedGetUrl(key, expiresIn=3600, downloadFilename?)` — para descargas; soporta `Content-Disposition: attachment` con nombre amigable.
- `deleteObject(key)` — borrado idempotente.
- `getObjectBuffer(key)` — descarga a memoria (uso interno: armado de ZIP, lectura de prompts).
- `generateKey(prefix, filename)` — convención `<prefix>/<base-slug>-<uuid><ext>`; slugifica el nombre original a `[a-z0-9-_]`.
- `S3Service.slugifyPathSegment(s)` — utilidad estática para normalizar segmentos del path S3 (`lowercase`, sin tildes, `[^a-z0-9]→_`, sin `_` duplicados/extremos).

### Convención de keys del proyecto

- Archivos de ejemplo por paso: prefijo `ejemplos/`.
- Archivos de respuesta del runner: prefijo `<empresa-slug>/<plantilla|actividad-slug>/respuesta/`.
- Prompts-template por pregunta: prefijo establecido por los endpoints `presign-prompt` (ver REQ-003/REQ-004).

### Entidades de base de datos

No tiene entidades propias. Persiste keys en columnas de otras entidades:
- `PasoActividad.ejemploKey`
- `PasoPlantilla.ejemploKey`
- `PreguntaActividad.urlPromptTemplate`
- `PreguntaPlantilla.urlPromptTemplate`
- `Respuesta.archivoKey`

### Interfaz expuesta

No expone endpoints HTTP propios. Los controladores consumen el servicio para:
- Generar presigned PUT URLs antes de upload directo (admin upload de ejemplos/prompts; ver REQ-003, REQ-004, REQ-006).
- Generar presigned GET URLs para descargas (runner, admin instancias).
- Subir archivos durante el flujo de respuesta (`POST /execution/:token/responder` cuando la pregunta tiene `subirArchivoS3: true`).
- Descargar buffers para armar ZIPs (`GET /admin/instancias/:id/zip` en REQ-009).

## Restricciones conocidas

- Si las variables `AWS_REGION`/`AWS_S3_BUCKET`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` no están seteadas, el servicio se inicializa en modo "no configurado" y todos los endpoints S3 fallan con `BadRequestException`. El backend NO crashea pero pierde la funcionalidad.
- Presigned PUT URL expira en 5 minutos por defecto; presigned GET en 1 hora.
- La convención de keys es responsabilidad del llamador (mediante `generateKey`/`slugifyPathSegment`); no hay validación centralizada que rechace prefijos arbitrarios.
- No hay versionado ni soft-delete de objetos S3: `deleteObject` borra definitivamente.
