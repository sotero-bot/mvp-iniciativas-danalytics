/**
 * Fase 4 (Plan 2 §4.1/§4.5 — RF-44/RF-45): el cliente_admin invita/revoca
 * `usuario_cliente` de SU empresa; duplicado → USUARIO_CLIENTE_DUPLICADO;
 * a lo sumo UN cliente_admin activo por empresa (CLIENTE_ADMIN_UNICO vía
 * captura de P2002 del índice parcial). Incluye la sincronización de la tabla
 * puente desde el módulo admin (§4.2).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { UsuarioClienteService } from '../../apps/api/src/modules/portal/application/usuario-cliente.service';
import { AdminUsersController } from '../../apps/api/src/modules/users/interfaces/admin-users.controller';

const EMPRESA = 'emp1';
const ACTOR = { sub: 'cli-admin-1', role: 'cliente_admin', empresaId: EMPRESA } as any;

const ROLE_USUARIO_CLIENTE = { id: 'role-uc', slug: 'usuario_cliente' };

function buildService(overrides: Record<string, any> = {}) {
  const prisma = {
    role: { findUnique: vi.fn().mockResolvedValue(ROLE_USUARIO_CLIENTE) },
    usuario: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        ...data,
        activo: true,
        role: { slug: 'usuario_cliente' },
      })),
      update: vi.fn().mockResolvedValue({}),
    },
    usuarioCliente: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockImplementation(async ({ create }: any) => ({
        id: 'uc-row-1',
        activo: true,
        invitadoEn: new Date(),
        invitadoPor: { id: create?.invitadoPorId ?? null, nombre: 'Cliente Admin' },
        usuario: { id: create?.usuarioId, nombre: 'Nueva', email: 'nueva@acme.co', activo: true, puedeIniciarSesion: true, role: { slug: 'usuario_cliente', nombre: 'Usuario cliente' } },
      })),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides.prisma,
  };
  const magicLink = { createAndSend: vi.fn().mockResolvedValue({ id: 'ml1', expiraEn: new Date() }), ...overrides.magicLink };
  return { service: new UsuarioClienteService(prisma as any, magicLink as any), prisma, magicLink };
}

describe('invitar (RF-44/RF-45)', () => {
  it('crea el Usuario con rol usuario_cliente EN la empresa del actor y envía magic link', async () => {
    const { service, prisma, magicLink } = buildService();
    const result = await service.invitar({
      empresaId: EMPRESA,
      invitadoPorId: ACTOR.sub,
      nombre: 'Nueva Usuaria',
      email: 'Nueva@Acme.co',
    });

    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nueva@acme.co',
          roleId: ROLE_USUARIO_CLIENTE.id,
          empresaId: EMPRESA,
          puedeIniciarSesion: true,
        }),
      }),
    );
    expect(prisma.usuarioCliente.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ empresaId: EMPRESA, invitadoPorId: ACTOR.sub, activo: true }),
      }),
    );
    expect(magicLink.createAndSend).toHaveBeenCalled();
    expect(result.invitacionEnviada).toBe(true);
  });

  it('membresía ya activa → USUARIO_CLIENTE_DUPLICADO (409)', async () => {
    const { service } = buildService({
      prisma: {
        usuario: {
          findFirst: vi.fn().mockResolvedValue({ id: 'u1', activo: true, puedeIniciarSesion: true, role: { slug: 'usuario_cliente' } }),
          create: vi.fn(),
          update: vi.fn(),
        },
        usuarioCliente: {
          findFirst: vi.fn().mockResolvedValue({ id: 'uc1', activo: true }),
          upsert: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          findMany: vi.fn(),
        },
      },
    });
    await expect(
      service.invitar({ empresaId: EMPRESA, invitadoPorId: ACTOR.sub, nombre: 'X', email: 'x@acme.co' }),
    ).rejects.toMatchObject({ code: 'USUARIO_CLIENTE_DUPLICADO', statusCode: 409 });
  });

  it('email de un usuario con OTRO rol → VALIDATION_ERROR (no se secuestra la cuenta)', async () => {
    const { service } = buildService({
      prisma: {
        usuario: {
          findFirst: vi.fn().mockResolvedValue({ id: 'u1', role: { slug: 'estudiante' } }),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    });
    await expect(
      service.invitar({ empresaId: EMPRESA, invitadoPorId: ACTOR.sub, nombre: 'X', email: 'x@acme.co' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('si el email de invitación falla, la membresía queda creada e invitacionEnviada=false', async () => {
    const { service } = buildService({
      magicLink: { createAndSend: vi.fn().mockRejectedValue(new Error('smtp caído')) },
    });
    const result = await service.invitar({
      empresaId: EMPRESA, invitadoPorId: ACTOR.sub, nombre: 'X', email: 'x@acme.co',
    });
    expect(result.invitacionEnviada).toBe(false);
  });
});

describe('revocar (RF-44)', () => {
  it('soft-revoca: UsuarioCliente.activo=false y apaga el login del usuario', async () => {
    const { service, prisma } = buildService({
      prisma: {
        usuarioCliente: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'uc1', usuarioId: 'u1',
            usuario: { id: 'u1', role: { slug: 'usuario_cliente' } },
          }),
          update: vi.fn().mockResolvedValue({}),
          upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(),
        },
      },
    });
    await service.revocar('uc1', EMPRESA);
    expect(prisma.usuarioCliente.update).toHaveBeenCalledWith({ where: { id: 'uc1' }, data: { activo: false } });
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { activo: false, puedeIniciarSesion: false },
    });
  });

  it('membresía de OTRA empresa (o inexistente) → USUARIO_CLIENTE_NOT_FOUND (RN-09)', async () => {
    const { service, prisma } = buildService({
      prisma: {
        usuarioCliente: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(),
        },
      },
    });
    await expect(service.revocar('uc-ajeno', EMPRESA)).rejects.toMatchObject({
      code: 'USUARIO_CLIENTE_NOT_FOUND',
      statusCode: 404,
    });
    expect(prisma.usuarioCliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'uc-ajeno', empresaId: EMPRESA } }),
    );
  });

  it('no puede revocar a un cliente_admin (solo gestiona usuario_cliente)', async () => {
    const { service } = buildService({
      prisma: {
        usuarioCliente: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'uc1', usuarioId: 'u1',
            usuario: { id: 'u1', role: { slug: 'cliente_admin' } },
          }),
          update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(),
        },
      },
    });
    await expect(service.revocar('uc1', EMPRESA)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('CLIENTE_ADMIN_UNICO (Plan 2 §4.4 — índice parcial + P2002)', () => {
  function p2002(meta?: Record<string, unknown>) {
    return new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta,
    });
  }

  it('esViolacionClienteAdminUnico detecta el índice por meta.target y por mensaje', () => {
    expect(
      UsuarioClienteService.esViolacionClienteAdminUnico(
        p2002({ target: 'usuario_cliente_admin_unico_por_empresa' }),
      ),
    ).toBe(true);
    expect(UsuarioClienteService.esViolacionClienteAdminUnico(p2002({ target: ['email'] }))).toBe(false);
    expect(UsuarioClienteService.esViolacionClienteAdminUnico(new Error('x'))).toBe(false);
  });

  it('crear un segundo cliente_admin activo en la empresa → CLIENTE_ADMIN_UNICO (409)', async () => {
    const prisma = {
      role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-ca', slug: 'cliente_admin' }) },
      usuario: {
        create: vi.fn().mockRejectedValue(p2002({ target: 'usuario_cliente_admin_unico_por_empresa' })),
      },
    };
    const controller = new AdminUsersController(prisma as any, {} as any);
    await expect(
      controller.create({ nombre: 'Otro Admin', role: 'cliente_admin', email: 'otro@acme.co', empresaId: EMPRESA }),
    ).rejects.toMatchObject({ code: 'CLIENTE_ADMIN_UNICO', statusCode: 409 });
  });

  it('un P2002 normal (email duplicado) sigue siendo USUARIO_DUPLICATE', async () => {
    const prisma = {
      role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-est', slug: 'estudiante' }) },
      usuario: { create: vi.fn().mockRejectedValue(p2002({ target: ['empresaId', 'email'] })) },
    };
    const controller = new AdminUsersController(prisma as any, {} as any);
    await expect(
      controller.create({ nombre: 'Dup', role: 'estudiante', email: 'dup@acme.co', empresaId: EMPRESA }),
    ).rejects.toMatchObject({ code: 'USUARIO_DUPLICATE' });
  });
});

describe('sincronización de la tabla puente desde admin (§4.2)', () => {
  it('rol cliente + empresa + activo → upsert activo (y desactiva filas de otras empresas)', async () => {
    const { service, prisma } = buildService();
    await service.sincronizarDesdeAdmin(
      { id: 'u1', empresaId: EMPRESA, activo: true, role: { slug: 'cliente_admin' } },
      'admin-1',
    );
    expect(prisma.usuarioCliente.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usuarioId: 'u1', empresaId: { not: EMPRESA } }),
        data: { activo: false },
      }),
    );
    expect(prisma.usuarioCliente.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ empresaId: EMPRESA, usuarioId: 'u1', invitadoPorId: 'admin-1', activo: true }),
      }),
    );
  });

  it('usuario desactivado o sin rol cliente → desactiva TODAS sus membresías', async () => {
    const { service, prisma } = buildService();
    await service.sincronizarDesdeAdmin({ id: 'u1', empresaId: EMPRESA, activo: false, role: null }, null);
    expect(prisma.usuarioCliente.upsert).not.toHaveBeenCalled();
    expect(prisma.usuarioCliente.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ usuarioId: 'u1', activo: true }), data: { activo: false } }),
    );
  });
});
