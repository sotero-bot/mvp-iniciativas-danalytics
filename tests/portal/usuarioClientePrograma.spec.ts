/**
 * C-07 (aclaración 2026-07-14): un usuario_cliente ve SOLO los programas de IA en
 * Acción que se le asignan. Cubre UsuarioClienteService.{programasAsignables,
 * asignarPrograma,desasignarPrograma}: validación de rol, guard de empresa (RN-09)
 * e idempotencia.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { UsuarioClienteService } from '../../apps/api/src/modules/portal/application/usuario-cliente.service';

const UC = { id: 'uc1', empresaId: 'emp1', role: { slug: 'usuario_cliente' } };

function build(overrides: Record<string, any> = {}) {
  const prisma: any = {
    usuario: { findUnique: vi.fn().mockResolvedValue(UC) },
    programa: {
      findUnique: vi.fn().mockResolvedValue({ id: 'p1', empresaId: 'emp1' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'p1', nombre: 'P1', estado: 'activo' }]),
    },
    usuarioClientePrograma: {
      findMany: vi.fn().mockResolvedValue([{ programaId: 'p1' }]),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides.prisma,
  };
  return { svc: new UsuarioClienteService(prisma as any, {} as any), prisma };
}

describe('C-07 · asignación de programas a usuario_cliente', () => {
  it('programasAsignables devuelve programas de la empresa + asignados', async () => {
    const { svc } = build();
    const res = await svc.programasAsignables('uc1', 'emp1');
    expect(res.programas).toEqual([{ id: 'p1', nombre: 'P1', estado: 'activo' }]);
    expect(res.asignados).toEqual(['p1']);
  });

  it('asignar crea la fila puente', async () => {
    const { svc, prisma } = build();
    await svc.asignarPrograma({ usuarioId: 'uc1', programaId: 'p1', asignadoPorId: 'admin1' });
    expect(prisma.usuarioClientePrograma.create).toHaveBeenCalledWith({
      data: { usuarioId: 'uc1', programaId: 'p1', asignadoPorId: 'admin1' },
    });
  });

  it('target que NO es usuario_cliente → USUARIO_CLIENTE_NOT_FOUND', async () => {
    const { svc } = build({
      prisma: { usuario: { findUnique: vi.fn().mockResolvedValue({ id: 'x', empresaId: 'emp1', role: { slug: 'estudiante' } }) } },
    });
    await expect(
      svc.asignarPrograma({ usuarioId: 'x', programaId: 'p1', asignadoPorId: 'a' }),
    ).rejects.toMatchObject({ code: 'USUARIO_CLIENTE_NOT_FOUND' });
  });

  it('guard de empresa: usuario_cliente de otra empresa → USUARIO_CLIENTE_NOT_FOUND (RN-09)', async () => {
    const { svc } = build();
    await expect(
      svc.asignarPrograma({ usuarioId: 'uc1', programaId: 'p1', asignadoPorId: 'a', empresaGuard: 'otra' }),
    ).rejects.toMatchObject({ code: 'USUARIO_CLIENTE_NOT_FOUND' });
  });

  it('programa de otra empresa que el usuario → PROGRAMA_NOT_FOUND (RN-09)', async () => {
    const { svc } = build({
      prisma: {
        usuario: { findUnique: vi.fn().mockResolvedValue(UC) },
        programa: { findUnique: vi.fn().mockResolvedValue({ id: 'p9', empresaId: 'otra' }) },
      },
    });
    await expect(
      svc.asignarPrograma({ usuarioId: 'uc1', programaId: 'p9', asignadoPorId: 'a' }),
    ).rejects.toMatchObject({ code: 'PROGRAMA_NOT_FOUND' });
  });

  it('reasignar lo ya asignado es idempotente (P2002 no propaga)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    const { svc } = build({
      prisma: {
        usuario: { findUnique: vi.fn().mockResolvedValue(UC) },
        programa: {
          findUnique: vi.fn().mockResolvedValue({ id: 'p1', empresaId: 'emp1' }),
          findMany: vi.fn().mockResolvedValue([{ id: 'p1', nombre: 'P1', estado: 'activo' }]),
        },
        usuarioClientePrograma: {
          create: vi.fn().mockRejectedValue(p2002),
          findMany: vi.fn().mockResolvedValue([{ programaId: 'p1' }]),
        },
      },
    });
    await expect(
      svc.asignarPrograma({ usuarioId: 'uc1', programaId: 'p1', asignadoPorId: 'a' }),
    ).resolves.toMatchObject({ asignados: ['p1'] });
  });

  it('desasignar borra la fila puente', async () => {
    const { svc, prisma } = build();
    await svc.desasignarPrograma({ usuarioId: 'uc1', programaId: 'p1' });
    expect(prisma.usuarioClientePrograma.deleteMany).toHaveBeenCalledWith({
      where: { usuarioId: 'uc1', programaId: 'p1' },
    });
  });
});
