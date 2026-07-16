/**
 * C-01 (aclaración 2026-07-14): un programa puede tener VARIOS facilitadores.
 * Cubre los endpoints de asignación N:M de AdminProgramasController y la
 * validación de rol / duplicado (FACILITADOR_YA_ASIGNADO vía P2002).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

const PROGRAMA_SHAPE = { id: 'p1', nombre: 'P', facilitadores: [{ usuario: { id: 'f1', nombre: 'Fac', email: null } }] };

function buildController(overrides: Record<string, any> = {}) {
  const prisma: any = {
    programa: {
      findUnique: vi.fn().mockResolvedValue({ id: 'p1' }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(PROGRAMA_SHAPE),
    },
    usuario: {
      findUnique: vi.fn().mockResolvedValue({ id: 'f1', role: { slug: 'facilitador' } }),
    },
    programaFacilitador: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides.prisma,
  };
  const controller = new AdminProgramasController(
    prisma as any,
    {} as any, // MagicLinkService
    {} as any, // TranslationService
    {} as any, // SnapshotFormulariosService
  );
  return { controller, prisma };
}

describe('C-01 · asignación de facilitadores (N:M)', () => {
  it('asignar valida rol=facilitador y crea la fila puente', async () => {
    const { controller, prisma } = buildController();
    const res = await controller.asignarFacilitador('p1', { usuarioId: 'f1' });
    expect(prisma.programaFacilitador.create).toHaveBeenCalledWith({
      data: { programaId: 'p1', usuarioId: 'f1' },
    });
    // shapePrograma aplana facilitadores: [{ usuario }] → [{ id, nombre, email }]
    expect(res.facilitadores).toEqual([{ id: 'f1', nombre: 'Fac', email: null }]);
  });

  it('asignar un usuario que NO es facilitador → FACILITADOR_INVALID', async () => {
    const { controller } = buildController({
      prisma: {
        programa: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) },
        usuario: { findUnique: vi.fn().mockResolvedValue({ id: 'x', role: { slug: 'estudiante' } }) },
        programaFacilitador: { create: vi.fn() },
      },
    });
    await expect(controller.asignarFacilitador('p1', { usuarioId: 'x' })).rejects.toMatchObject({
      code: 'FACILITADOR_INVALID',
    });
  });

  it('asignar dos veces el mismo facilitador → FACILITADOR_YA_ASIGNADO (P2002)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
    const { controller } = buildController({
      prisma: {
        programa: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }), findUniqueOrThrow: vi.fn() },
        usuario: { findUnique: vi.fn().mockResolvedValue({ id: 'f1', role: { slug: 'facilitador' } }) },
        programaFacilitador: { create: vi.fn().mockRejectedValue(p2002) },
      },
    });
    await expect(controller.asignarFacilitador('p1', { usuarioId: 'f1' })).rejects.toMatchObject({
      code: 'FACILITADOR_YA_ASIGNADO',
    });
  });

  it('asignar a un programa inexistente → PROGRAMA_NOT_FOUND', async () => {
    const { controller } = buildController({
      prisma: { programa: { findUnique: vi.fn().mockResolvedValue(null) } },
    });
    await expect(controller.asignarFacilitador('nope', { usuarioId: 'f1' })).rejects.toMatchObject({
      code: 'PROGRAMA_NOT_FOUND',
    });
  });

  it('quitar facilitador borra la fila puente (idempotente)', async () => {
    const { controller, prisma } = buildController();
    await controller.quitarFacilitador('p1', 'f1');
    expect(prisma.programaFacilitador.deleteMany).toHaveBeenCalledWith({
      where: { programaId: 'p1', usuarioId: 'f1' },
    });
  });
});
