/**
 * Lógica de negocio de `AdminGruposController.addMiembro` (RF-14, RN-04).
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminGruposController } from '../../apps/api/src/modules/grupos/interfaces/admin-grupos.controller';
import { AppError } from '../../apps/api/src/shared/errors/AppError';

function buildController(overrides: Record<string, unknown> = {}) {
  const prismaMock = {
    grupo: {
      findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }),
    },
    participantePrograma: {
      findFirst: vi.fn().mockResolvedValue({ id: 'part1', activo: true }),
    },
    miembroGrupo: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'm1', grupoId: 'g1', usuarioId: 'u1' }),
    },
    ...overrides,
  };
  return { controller: new AdminGruposController(prismaMock as any), prismaMock };
}

describe('AdminGruposController.addMiembro', () => {
  it('GRUPO_NOT_FOUND si el grupo no existe', async () => {
    const { controller } = buildController({
      grupo: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(controller.addMiembro('g1', { usuarioId: 'u1' })).rejects.toMatchObject({
      code: 'GRUPO_NOT_FOUND',
    });
  });

  it('MIEMBRO_NO_PARTICIPA si el usuario no es participante activo del programa', async () => {
    const { controller } = buildController({
      participantePrograma: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(controller.addMiembro('g1', { usuarioId: 'u1' })).rejects.toBeInstanceOf(AppError);
    await expect(controller.addMiembro('g1', { usuarioId: 'u1' })).rejects.toMatchObject({
      code: 'MIEMBRO_NO_PARTICIPA',
    });
  });

  it('MIEMBRO_YA_EN_GRUPO si ya pertenece a un grupo del programa', async () => {
    const { controller } = buildController({
      miembroGrupo: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
        create: vi.fn(),
      },
    });
    await expect(controller.addMiembro('g1', { usuarioId: 'u1' })).rejects.toMatchObject({
      code: 'MIEMBRO_YA_EN_GRUPO',
    });
  });

  it('crea el miembro cuando participa y no está en otro grupo', async () => {
    const { controller, prismaMock } = buildController();
    const result = await controller.addMiembro('g1', { usuarioId: 'u1' });
    expect(result).toMatchObject({ id: 'm1' });
    expect((prismaMock.miembroGrupo.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grupoId: 'g1', programaId: 'p1', usuarioId: 'u1' }),
      }),
    );
  });

  it('mapea la violación de unicidad P2002 a MIEMBRO_YA_EN_GRUPO (carrera concurrente)', async () => {
    const { Prisma } = await import('@prisma/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { controller } = buildController({
      miembroGrupo: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(p2002),
      },
    });
    await expect(controller.addMiembro('g1', { usuarioId: 'u1' })).rejects.toMatchObject({
      code: 'MIEMBRO_YA_EN_GRUPO',
    });
  });
});
