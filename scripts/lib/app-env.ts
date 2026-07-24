/**
 * Resolución del entorno de ejecución para scripts operativos.
 *
 * Fuente de verdad ÚNICA: la env var `APP_ENV` (`production` | `development` |
 * `test`), configurada explícitamente en cada entorno (en Vercel: Project
 * Settings → Environment Variables). No se miran otras señales (VERCEL/CI/
 * NODE_ENV).
 *
 * Solo se considera pruebas/desarrollo cuando `APP_ENV` es exactamente
 * `development` o `test`. Cualquier otro valor —incluido `production`, un valor
 * no reconocido o la variable sin definir— se trata como producción, para que un
 * seed/destructivo nunca corra por olvidar o escribir mal la variable. Ver regla
 * dura: nunca reset-data / seeds de prueba en producción.
 */

export type AppEnv = 'production' | 'development' | 'test';

/** Entorno declarado por `APP_ENV`. `undefined` si no está definida o no es válida. */
export function declaredAppEnv(): AppEnv | undefined {
  const raw = (process.env.APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'production' || raw === 'development' || raw === 'test') return raw;
  return undefined;
}

/** `true` en pruebas/desarrollo: SOLO si `APP_ENV` es `development` o `test`. */
export function isDevOrTest(): boolean {
  const declared = declaredAppEnv();
  return declared === 'development' || declared === 'test';
}

/** `true` si NO estamos en pruebas/desarrollo (incluye `APP_ENV` ausente o inválida). */
export function isProduction(): boolean {
  return !isDevOrTest();
}

/**
 * Aborta el proceso si NO estamos en pruebas/desarrollo. Úsalo al inicio de
 * cualquier script que cree datos de prueba, usuarios con contraseña conocida
 * o borre información.
 */
export function assertDevOrTest(scriptName: string): void {
  if (!isDevOrTest()) {
    console.error(
      `⛔  ${scriptName} solo puede ejecutarse con APP_ENV=development|test. ` +
        `Valor actual: APP_ENV=${process.env.APP_ENV ?? 'undefined'}. Abortado.`,
    );
    process.exit(1);
  }
}
