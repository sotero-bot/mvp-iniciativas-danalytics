/**
 * Validación de agenda de sesiones (aclaración 2026-07-15):
 *  (1) la fecha debe caer dentro del rango de fechas del programa;
 *  (2) debe haber ≥4 h de separación con cualquier otra sesión del programa.
 * Ver `AdminProgramasController.assertSesionSchedule`.
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

// Programa America/Bogota (UTC-5), del 2026-08-01 al 2026-08-31 (límites en medianoche UTC).
const PROGRAMA = {
  id: 'p1',
  timezone: 'America/Bogota',
  fechaInicio: new Date('2026-08-01'),
  fechaFin: new Date('2026-08-31'),
};

function buildController(hermanas: { fechaProgramada: Date }[] = []) {
  const prismaMock = {
    programa: {
      findUnique: vi.fn().mockResolvedValue(PROGRAMA),
    },
    sesion: {
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      findUnique: vi.fn().mockResolvedValue({ id: 's1', programaId: 'p1' }),
      findMany: vi.fn().mockResolvedValue(hermanas),
    },
  };
  const controller = new AdminProgramasController(prismaMock as any, {} as any, {} as any, {} as any);
  return { controller, prismaMock };
}

function crear(controller: AdminProgramasController, fechaProgramada: string) {
  return controller.createSesion('p1', {
    numeroSesion: 1,
    titulo: 'Sesión',
    fechaProgramada,
  } as any);
}

describe('AdminProgramasController — rango de fechas del programa', () => {
  it('rechaza una sesión anterior al inicio del programa', async () => {
    const { controller } = buildController();
    // 2026-07-31 15:00 Bogotá → cae el 31/07, antes del 01/08.
    await expect(crear(controller, '2026-07-31T20:00:00Z')).rejects.toMatchObject({
      code: 'SESION_FUERA_DE_RANGO',
    });
  });

  it('rechaza una sesión posterior al fin del programa', async () => {
    const { controller } = buildController();
    // 2026-09-01 00:00 Bogotá → 01/09, después del 31/08.
    await expect(crear(controller, '2026-09-01T05:00:00Z')).rejects.toMatchObject({
      code: 'SESION_FUERA_DE_RANGO',
    });
  });

  it('acepta una sesión dentro del rango (incluye el último día del programa)', async () => {
    const { controller } = buildController();
    // 2026-08-31 18:00 Bogotá → 31/08, aún dentro del rango pese a la hora.
    const result = await crear(controller, '2026-08-31T23:00:00Z');
    expect((result as any).numeroSesion).toBe(1);
  });
});

describe('AdminProgramasController — separación mínima entre sesiones', () => {
  it('rechaza una sesión a menos de 4 h de otra del mismo programa', async () => {
    const { controller } = buildController([{ fechaProgramada: new Date('2026-08-15T17:00:00Z') }]);
    await expect(crear(controller, '2026-08-15T19:00:00Z')).rejects.toMatchObject({
      code: 'SESION_INTERVALO_MINIMO',
    });
  });

  it('acepta una sesión con ≥4 h de separación', async () => {
    const { controller } = buildController([{ fechaProgramada: new Date('2026-08-15T17:00:00Z') }]);
    const result = await crear(controller, '2026-08-15T22:00:00Z');
    expect((result as any).numeroSesion).toBe(1);
  });

  it('al editar, una sesión no choca consigo misma', async () => {
    // La única "hermana" es la propia sesión editada → debe excluirse por id.
    const { controller, prismaMock } = buildController();
    prismaMock.sesion.findUnique.mockResolvedValue({ id: 's1', programaId: 'p1' });
    const result = await controller.updateSesion('s1', {
      fechaProgramada: '2026-08-15T17:00:00Z',
    } as any);
    expect((result as any).fechaProgramada.toISOString()).toBe('2026-08-15T17:00:00.000Z');
    // findMany se llamó excluyendo la propia sesión.
    expect(prismaMock.sesion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 's1' } }) }),
    );
  });
});
