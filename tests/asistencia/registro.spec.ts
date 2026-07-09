/**
 * Lógica de negocio de `FacilitadorAsistenciaController.putAsistencia`
 * (RF-17 batch, RF-18 sesión futura, RF-19 ventana 24h, RF-10 marcado automático).
 */

import { describe, it, expect, vi } from 'vitest';

import { FacilitadorAsistenciaController } from '../../apps/api/src/modules/asistencia/interfaces/facilitador-asistencia.controller';
import { AppError } from '../../apps/api/src/shared/errors/AppError';

const ACTOR = { sub: 'facil-1', userId: 'facil-1', role: 'facilitador' as const, empresaId: null };

function buildController(overrides: Record<string, unknown> = {}) {
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const prismaMock = {
    sesion: {
      findUnique: vi.fn().mockResolvedValue({ id: 's1', programaId: 'p1', fechaProgramada: ayer }),
      update: vi.fn().mockResolvedValue({}),
    },
    programa: {
      findUnique: vi.fn().mockResolvedValue({ marcarSesionAutomatica: false }),
      findFirst: vi.fn().mockResolvedValue({ id: 'p1' }), // usado por ActorScopeService real
    },
    asistencia: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    participantePrograma: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
  const scopeStub = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined) };
  const controller = new FacilitadorAsistenciaController(prismaMock as any, scopeStub as any);
  return { controller, prismaMock, scopeStub };
}

describe('FacilitadorAsistenciaController.putAsistencia', () => {
  it('SESION_FUTURA si fechaProgramada es en el futuro', async () => {
    const { controller } = buildController({
      sesion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 's1',
          programaId: 'p1',
          fechaProgramada: new Date(Date.now() + 86_400_000),
        }),
      },
    });
    await expect(
      controller.putAsistencia('s1', { registros: [{ usuarioId: 'u1', presente: true }] }, ACTOR),
    ).rejects.toMatchObject({ code: 'SESION_FUTURA' });
  });

  it('SESION_NOT_FOUND si la sesión no existe', async () => {
    const { controller } = buildController({ sesion: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(
      controller.putAsistencia('s1', { registros: [] }, ACTOR),
    ).rejects.toMatchObject({ code: 'SESION_NOT_FOUND' });
  });

  it('ASISTENCIA_FUERA_DE_PLAZO si ya pasaron 24h desde el primer registro', async () => {
    const hace2dias = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const { controller } = buildController({
      asistencia: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'a1', usuarioId: 'u1', createdAt: hace2dias, presente: false }]),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
    await expect(
      controller.putAsistencia('s1', { registros: [{ usuarioId: 'u1', presente: true }] }, ACTOR),
    ).rejects.toMatchObject({ code: 'ASISTENCIA_FUERA_DE_PLAZO' });
  });

  it('crea registros nuevos con registradoPorId = actor.sub', async () => {
    const { controller, prismaMock } = buildController();
    await controller.putAsistencia(
      's1',
      { registros: [{ usuarioId: 'u1', presente: true, nota: 'llegó tarde' }] },
      ACTOR,
    );
    expect(prismaMock.asistencia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sesionId: 's1',
          usuarioId: 'u1',
          presente: true,
          registradoPorId: 'facil-1',
        }),
      }),
    );
  });

  it('RF-10: marca la sesión completada si el programa está en modo automático', async () => {
    const { controller, prismaMock } = buildController({
      programa: { findUnique: vi.fn().mockResolvedValue({ marcarSesionAutomatica: true }) },
    });
    await controller.putAsistencia('s1', { registros: [{ usuarioId: 'u1', presente: true }] }, ACTOR);
    expect(prismaMock.sesion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: { estado: 'completada' } }),
    );
  });

  it('no marca la sesión si el programa NO está en modo automático', async () => {
    const { controller, prismaMock } = buildController();
    await controller.putAsistencia('s1', { registros: [{ usuarioId: 'u1', presente: true }] }, ACTOR);
    expect(prismaMock.sesion.update).not.toHaveBeenCalled();
  });

  it('propaga el 403 de ActorScopeService.assertProgramaAccessible (RF-03/scoping)', async () => {
    const { controller, scopeStub } = buildController();
    (scopeStub.assertProgramaAccessible as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError('FORBIDDEN'),
    );
    await expect(
      controller.putAsistencia('s1', { registros: [] }, ACTOR),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
