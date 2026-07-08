import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Carga las variables de `.env` a `process.env` en desarrollo local.
 *
 * DEBE importarse ANTES que `AppModule` en `main.ts`: algunos módulos leen
 * `process.env` en tiempo de import (p. ej. `JwtModule.register`), no solo en
 * runtime.
 *
 * En producción (Vercel / host propio) normalmente no hay archivo `.env` y las
 * variables las inyecta la plataforma → aquí es un no-op silencioso.
 *
 * Nota: usa el cargador nativo de Node (≥ 20.12). No expande `${VAR}`; las
 * únicas variables con interpolación (`POSTGRES_*`) las resuelve Prisma por su
 * cuenta, no el runtime de Nest.
 */
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}
