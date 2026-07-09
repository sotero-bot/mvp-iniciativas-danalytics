/**
 * Tests de GoogleStrategy (RF-13, Plan 2 §1.1) — reglas duras del login con Google.
 *
 * Cubre:
 * - Usuario no registrado → OAUTH_USUARIO_NO_REGISTRADO (NUNCA crea usuarios).
 * - Email no verificado → OAUTH_EMAIL_NO_VERIFICADO.
 * - Dominio del correo distinto al Workspace de la empresa → OAUTH_DOMINIO_NO_AUTORIZADO.
 * - Camino feliz → done(null, AuthUser {sub, role, empresaId}) + vincula googleId.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// La construcción de passport-google-oauth20 exige clientID: setear ANTES de importar.
beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
});

async function makeStrategy(prismaMock: unknown) {
  const { GoogleStrategy } = await import(
    '../../apps/api/src/modules/auth/infrastructure/google.strategy'
  );
  return new GoogleStrategy(prismaMock as never);
}

function profile(email: string, emailVerified = true, id = 'g-123') {
  return { id, emails: [{ value: email }], _json: { email_verified: emailVerified } } as never;
}

/** Ejecuta validate y captura el resultado del callback done(err, user). */
async function run(strategy: { validate: Function }, prof: unknown) {
  return new Promise<{ err: unknown; user: unknown }>((resolve) => {
    strategy.validate('at', 'rt', prof, (err: unknown, user: unknown) => resolve({ err, user }));
  });
}

describe('GoogleStrategy.validate (§1.1)', () => {
  it('usuario no registrado → OAUTH_USUARIO_NO_REGISTRADO (no crea usuarios)', async () => {
    const prisma = { usuario: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    } };
    const s = await makeStrategy(prisma);
    const { err, user } = await run(s, profile('nadie@acme.com'));
    expect(user).toBe(false);
    expect((err as { code?: string })?.code).toBe('OAUTH_USUARIO_NO_REGISTRADO');
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('email no verificado → OAUTH_EMAIL_NO_VERIFICADO', async () => {
    const prisma = { usuario: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } };
    const s = await makeStrategy(prisma);
    const { err } = await run(s, profile('user@acme.com', false));
    expect((err as { code?: string })?.code).toBe('OAUTH_EMAIL_NO_VERIFICADO');
  });

  it('match por username (== email): devuelve el usuario único, no uno arbitrario por email', async () => {
    // findUnique({username}) encuentra al usuario correcto; findFirst NO debe ni llamarse.
    const findFirst = vi.fn().mockResolvedValue({ id: 'OTRO', role: { slug: 'estudiante' } });
    const prisma = { usuario: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'admin1', email: 'user@acme.com', username: 'user@acme.com', empresaId: null,
        activo: true, puedeIniciarSesion: true,
        role: { slug: 'danalytics_admin' }, empresa: null,
      }),
      findFirst,
      update: vi.fn().mockResolvedValue({}),
    } };
    const s = await makeStrategy(prisma);
    const { err, user } = await run(s, profile('user@acme.com'));
    expect(err).toBeNull();
    expect(user).toMatchObject({ sub: 'admin1', role: 'danalytics_admin' });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('dominio distinto al Workspace de la empresa → OAUTH_DOMINIO_NO_AUTORIZADO', async () => {
    const prisma = {
      usuario: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1', email: 'user@gmail.com', username: 'user@gmail.com', empresaId: 'e1',
          activo: true, puedeIniciarSesion: true,
          role: { slug: 'estudiante' }, empresa: { dominioGoogleWorkspace: 'acme.com' },
        }),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    const s = await makeStrategy(prisma);
    const { err } = await run(s, profile('user@gmail.com'));
    expect((err as { code?: string })?.code).toBe('OAUTH_DOMINIO_NO_AUTORIZADO');
  });

  it('camino feliz → done(null, AuthUser) y vincula googleId', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      usuario: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1', email: 'user@acme.com', username: 'user@acme.com', empresaId: 'e1',
          activo: true, puedeIniciarSesion: true,
          role: { slug: 'estudiante' }, empresa: { dominioGoogleWorkspace: 'acme.com' },
        }),
        findFirst: vi.fn(),
        update,
      },
    };
    const s = await makeStrategy(prisma);
    const { err, user } = await run(s, profile('user@acme.com'));
    expect(err).toBeNull();
    expect(user).toMatchObject({ sub: 'u1', role: 'estudiante', empresaId: 'e1' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { googleId: 'g-123', googleEmailVerificado: true },
    });
  });
});
