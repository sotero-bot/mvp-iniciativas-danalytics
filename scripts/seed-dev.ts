/**
 * Paso de seeding SOLO para entornos no productivos, invocado desde `vercel-build`.
 *
 * En producción es un no-op (exit 0) para no romper el build. En development/test
 * ejecuta el seed de usuarios de prueba (rbac-scopes), que crea el admin de prueba
 * (admin/test123) y la matriz de usuarios de prueba.
 *
 * Nota: al haberse retirado `seed:admin` del build, este seed asume que los ROLES
 * ya existen en la BD. Si corres contra una BD vacía, primero crea los roles
 * (p. ej. `npm run seed:admin` una vez en local) o pídeme que haga rbac autónomo.
 */
import { execSync } from 'child_process';

import { isProduction } from './lib/app-env';

if (isProduction()) {
  console.log('⏭  seed:dev omitido: entorno de producción (APP_ENV=production o señal de deploy).');
  process.exit(0);
}

console.log('🌱  seed:dev — entorno no productivo: ejecutando seed de usuarios de prueba (rbac-scopes)\n');
execSync('npx tsx scripts/seed-rbac-scopes.ts', { stdio: 'inherit' });
