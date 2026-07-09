/**
 * RF-09/RN-05: `AdminProgramasController` calcula `materialDesbloqueoEn` automáticamente
 * al crear/editar una `Sesion`, salvo que se envíe explícito.
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

function buildController(overrides: Record<string, unknown> = {}) {
  const prismaMock = {
    programa: {
      findUnique: vi.fn().mockResolvedValue({ id: 'p1', timezone: 'America/Bogota' }),
    },
    sesion: {
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      findUnique: vi.fn().mockResolvedValue({ id: 's1', programaId: 'p1' }),
    },
    ...overrides,
  };
  const controller = new AdminProgramasController(prismaMock as any, {} as any, {} as any);
  return { controller, prismaMock };
}

describe('AdminProgramasController.createSesion — materialDesbloqueoEn automático', () => {
  it('calcula 00:01 del día siguiente en la timezone del programa si no se envía explícito', async () => {
    const { controller } = buildController();
    const result = await controller.createSesion('p1', {
      numeroSesion: 1,
      titulo: 'Sesión 1',
      fechaProgramada: '2026-07-06T17:00:00Z', // mediodía en Bogotá (UTC-5)
    } as any);
    expect((result as any).materialDesbloqueoEn.toISOString()).toBe('2026-07-07T05:01:00.000Z');
  });

  it('respeta materialDesbloqueoEn explícito si se envía', async () => {
    const { controller } = buildController();
    const result = await controller.createSesion('p1', {
      numeroSesion: 1,
      titulo: 'Sesión 1',
      fechaProgramada: '2026-07-06T17:00:00Z',
      materialDesbloqueoEn: '2026-07-10T00:00:00Z',
    } as any);
    expect((result as any).materialDesbloqueoEn.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });
});

describe('AdminProgramasController.updateSesion — materialDesbloqueoEn automático', () => {
  it('recalcula si cambia fechaProgramada y no se envía materialDesbloqueoEn', async () => {
    const { controller } = buildController();
    const result = await controller.updateSesion('s1', {
      fechaProgramada: '2026-07-06T17:00:00Z',
    } as any);
    expect((result as any).materialDesbloqueoEn.toISOString()).toBe('2026-07-07T05:01:00.000Z');
  });

  it('no toca materialDesbloqueoEn si no cambia fechaProgramada ni se envía', async () => {
    const { controller } = buildController();
    const result = await controller.updateSesion('s1', { titulo: 'Nuevo título' } as any);
    expect((result as any).materialDesbloqueoEn).toBeUndefined();
  });
});
