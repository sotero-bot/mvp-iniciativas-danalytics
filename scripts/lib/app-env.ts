/**
 * Resolución del entorno de ejecución para scripts operativos.
 *
 * Fuente de verdad: la env var `APP_ENV` (`production` | `development` | `test`),
 * que se configura explícitamente en cada entorno (en Vercel: Project Settings →
 * Environment Variables → `APP_ENV=production` para el deploy de producción).
 *
 * Como defensa en profundidad, cualquier señal automática de producción
 * (Vercel, CI, `NODE_ENV=production`) también cuenta como producción aunque
 * `APP_ENV` no esté definida — así un script destructivo/seed jamás corre en
 * un deploy real por olvidar la variable. Ver regla dura: nunca reset-data /
 * seeds de prueba en producción.
 */

export type AppEnv = 'production' | 'development' | 'test';

/** Entorno declarado por `APP_ENV`. `undefined` si no está definida. */
export function declaredAppEnv(): AppEnv | undefined {
  const raw = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'production' || raw === 'development' || raw === 'test') return raw;
  return undefined;
}

/** Señales automáticas de un entorno de producción/despliegue. */
function looksLikeProductionRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production');
}

/**
 * `true` si estamos en producción.
 *
 * `APP_ENV`, cuando está definida explícitamente, MANDA sobre todo lo demás
 * (imprescindible: Vercel siempre define `VERCEL=1`, así que sin esta precedencia
 * un preview con `APP_ENV=development` se tomaría como producción). Solo cuando
 * `APP_ENV` NO está definida se cae a las señales automáticas de deploy, para que
 * un despliegue sin la variable sea "producción" por seguridad.
 */
export function isProduction(): boolean {
  const declared = declaredAppEnv();
  if (declared) return declared === 'production';
  return looksLikeProductionRuntime();
}

/** `true` en pruebas/desarrollo: todo lo que NO es producción. */
export function isDevOrTest(): boolean {
  return !isProduction();
}

/**
 * Aborta el proceso si NO estamos en pruebas/desarrollo. Úsalo al inicio de
 * cualquier script que cree datos de prueba, usuarios con contraseña conocida
 * o borre información.
 */
export function assertDevOrTest(scriptName: string): void {
  if (isProduction()) {
    console.error(
      `⛔  ${scriptName} solo puede ejecutarse en pruebas/desarrollo (APP_ENV=development|test). ` +
        `Entorno detectado como producción (APP_ENV=${process.env.APP_ENV ?? 'undefined'}). Abortado.`,
    );
    process.exit(1);
  }
}
