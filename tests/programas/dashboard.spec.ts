/**
 * RF-04: `GET /admin/programas/dashboard` — resumen por programa activo.
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

function buildController() {
  const prismaMock = {
    programa: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'p1',
          nombre: 'Programa X',
          totalSesionesEsperadas: 5,
          sesiones: [
            { id: 's1', estado: 'completada' },
            { id: 's2', estado: 'pendiente' },
          ],
        },
      ]),
    },
    participantePrograma: { count: vi.fn().mockResolvedValue(10) },
    asistencia: {
      findMany: vi.fn().mockResolvedValue([
        { presente: true },
        { presente: true },
        { presente: false },
      ]),
    },
  };
  return new AdminProgramasController(prismaMock as any, {} as any, {} as any);
}

describe('AdminProgramasController.dashboard', () => {
  it('devuelve sesiones completadas/totales, participantes y asistencia promedio', async () => {
    const controller = buildController();
    const result = await controller.dashboard();
    expect(result).toEqual([
      {
        id: 'p1',
        nombre: 'Programa X',
        sesionesCompletadas: 1,
        totalSesiones: 5,
        participantesActivos: 10,
        asistenciaPromedio: 2 / 3,
      },
    ]);
  });

  it('asistenciaPromedio es null si todavía no hay registros', async () => {
    const prismaMock = {
      programa: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', nombre: 'Programa X', totalSesionesEsperadas: null, sesiones: [] },
        ]),
      },
      participantePrograma: { count: vi.fn().mockResolvedValue(0) },
      asistencia: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const controller = new AdminProgramasController(prismaMock as any, {} as any, {} as any);
    const result = await controller.dashboard();
    expect(result[0]).toMatchObject({ totalSesiones: 0, asistenciaPromedio: null });
  });
});
