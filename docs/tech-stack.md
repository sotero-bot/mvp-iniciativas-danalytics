# Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + Vite | React 19.2, Vite 7.3 |
| Router (frontend) | React Router DOM | 7.13 |
| Editor de texto enriquecido | TipTap | 3.20 |
| Editor Markdown | UIW React MD Editor + react-markdown | 4.0 / 10.1 |
| Backend/API | NestJS (Express) | 11.1 |
| Lenguaje | TypeScript | 5.9 |
| ORM | Prisma | 5.22 |
| Base de datos | PostgreSQL — Supabase vía Vercel Postgres | 17.6 |
| Autenticación | Passport + JWT (local strategy) | @nestjs/jwt 11.0 |
| Storage | AWS S3 (SDK v3) — bucket `ia-gobernanza` | @aws-sdk/client-s3 3.x |
| IA generativa | OpenAI API (modelo vía env var) | SDK 6.25 |
| Generación de PDF | PDFKit | 0.18 |
| Procesamiento Excel | ExcelJS | 4.4 |
| Procesamiento Word | Mammoth | 1.11 |
| Hosting | Vercel (vercel.json v2) | — |
| Sistema de migraciones | `npx prisma db push` | — |

## Integraciones externas obligatorias

- **OpenAI API** — asistencia IA dentro de cada paso del taller (modelo configurable vía `OPENAI_API_KEY` + `OPENAI_MODEL`)
- **AWS S3** — almacenamiento de plantillas, archivos subidos por participantes y PDFs generados (bucket `ia-gobernanza`)

## Estructura del monorepo

Dos apps bajo `apps/`:
- `apps/api` — NestJS (backend + API REST)
- `apps/web` — React + Vite (frontend SPA)

Arranque en desarrollo: `concurrently` ejecuta ambas en paralelo (`ts-node-dev` para la API, `vite` para el frontend). Sin workspace manager (Turbo/Nx).

## Restricciones técnicas no negociables

- El deploy en Vercel ejecuta `prisma db push --accept-data-loss` en cada release — no usar migraciones destructivas sin respaldo previo.
- El modelo OpenAI es configurable por variable de entorno; el código NO debe asumir un modelo específico hardcodeado.
- Los archivos subidos por participantes y los PDFs generados SIEMPRE van a S3, nunca al sistema de archivos local.
