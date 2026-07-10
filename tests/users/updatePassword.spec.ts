/**
 * `AdminUsersController.update` / `resetPassword` — permitir poner/cambiar la
 * contraseña de CUALQUIER usuario (no solo danalytics_admin), y garantizar que
 * quede con `username` poblado — el login busca por `username`, no por `email`
 * (`AuthService.validateUser`). Usuarios matriculados como estudiante/facilitador
 * (canal normal: magic link/OAuth) suelen tener `username = null`; sin el
 * backfill quedarían con password válido pero sin forma de loguearse.
 */

import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';

import { AdminUsersController } from '../../apps/api/src/modules/users/interfaces/admin-users.controller';

function buildController(existingOverrides: Record<string, unknown> = {}) {
  const existing = {
    id: 'u1',
    role: { id: 'r1', slug: 'facilitador' },
    username: null,
    email: 'ana@acme.com',
    ...existingOverrides,
  };
  const prismaMock = {
    usuario: {
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'u1', ...data })),
    },
    role: {
      findUnique: vi.fn().mockResolvedValue({ id: 'r-admin', slug: 'danalytics_admin' }),
    },
  };
  const controller = new AdminUsersController(prismaMock as any, {} as any);
  return { controller, prismaMock };
}

describe('AdminUsersController.update — password', () => {
  it('actualiza la contraseña (hasheada) para un usuario danalytics_admin', async () => {
    const { controller, prismaMock } = buildController({
      role: { slug: 'danalytics_admin' },
      username: 'admin2',
    });
    await controller.update('u1', { password: 'nuevaClave123' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.password).toBeDefined();
    expect(data.password).not.toBe('nuevaClave123');
    await expect(bcrypt.compare('nuevaClave123', data.password)).resolves.toBe(true);
  });

  it('también actualiza la contraseña para roles no-admin (facilitador, estudiante, etc.)', async () => {
    const { controller, prismaMock } = buildController();
    await controller.update('u1', { password: 'nuevaClave123' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.password).toBeDefined();
    await expect(bcrypt.compare('nuevaClave123', data.password)).resolves.toBe(true);
  });

  it('permite setear password al mismo tiempo que se cambia el rol', async () => {
    const { controller, prismaMock } = buildController();
    await controller.update('u1', { role: 'danalytics_admin', password: 'nuevaClave123' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.password).toBeDefined();
  });

  it('no toca password si no viene en el body', async () => {
    const { controller, prismaMock } = buildController();
    await controller.update('u1', { nombre: 'Nuevo nombre' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.password).toBeUndefined();
  });

  it('un password vacío no dispara el cambio (evita hashear string vacío)', async () => {
    const { controller, prismaMock } = buildController();
    await controller.update('u1', { password: '' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.password).toBeUndefined();
  });

  it('bug real: si el usuario no tiene username, lo autocompleta con su email al poner password', async () => {
    const { controller, prismaMock } = buildController({ username: null, email: 'ana@acme.com' });
    await controller.update('u1', { password: 'nuevaClave123' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.username).toBe('ana@acme.com');
  });

  it('no pisa un username ya existente al poner password', async () => {
    const { controller, prismaMock } = buildController({ username: 'ana.custom' });
    await controller.update('u1', { password: 'nuevaClave123' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.username).toBeUndefined();
  });

  it('VALIDATION_ERROR si el usuario no tiene username NI email (no podría loguearse nunca)', async () => {
    const { controller } = buildController({ username: null, email: null });
    await expect(controller.update('u1', { password: 'x' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});

describe('AdminUsersController.resetPassword', () => {
  it('autocompleta username con el email si el usuario no tenía uno', async () => {
    const { controller, prismaMock } = buildController({ username: null, email: 'ana@acme.com' });
    await controller.resetPassword('u1', { password: 'nuevaClave123' });
    const data = (prismaMock.usuario.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.username).toBe('ana@acme.com');
    await expect(bcrypt.compare('nuevaClave123', data.password as string)).resolves.toBe(true);
  });

  it('VALIDATION_ERROR si no hay username ni email para hacer login posible', async () => {
    const { controller } = buildController({ username: null, email: null });
    await expect(controller.resetPassword('u1', { password: 'x' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('funciona igual para cualquier rol (ya no está restringido a danalytics_admin)', async () => {
    const { controller, prismaMock } = buildController({ role: { slug: 'estudiante' } });
    await controller.resetPassword('u1', { password: 'nuevaClave123' });
    expect(prismaMock.usuario.update).toHaveBeenCalled();
  });
});
