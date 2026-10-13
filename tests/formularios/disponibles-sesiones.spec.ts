/**
 * HU-13: `GET /formularios/disponibles` indica a qué sesiones está ligado cada formulario,
 * para que el estudiante lo vea y lo responda también desde la sesión.
 */
import { describe, it, expect, vi } from 'vitest';
import 'reflect-metadata';

import { EstudianteFormulariosController } from '../../apps/api/src/modules/formularios/interfaces/estudiante-formularios.controller';

const ESTUDIANTE = { sub: 'e1', userId: 'e1', role: 'estudiante' as const, empresaId: null };

function build(plantillas: unknown[]) {
  const prisma = { plantillaFormulario: { findMany: vi.fn().mockResolvedValue(plantillas) } };
  const scope = { programaScope: vi.fn().mockReturnValue({}) };
  return {
    controller: new EstudianteFormulariosController(prisma as any, scope as any, {} as any),
    prisma,
  };
}

const base = {
  id: 'pl1',
  programaId: 'p1',
  programa: { id: 'p1', nombre: 'P1' },
  tipoFormulario: 'feedback',
  nombre: 'Feedback',
  descripcion: null,
  respuestas: [],
};

describe('GET formularios/disponibles — sesiones (HU-13)', () => {
  it('cada formulario trae sus sesiones ordenadas por número', async () => {
    const { controller } = build([
      {
        ...base,
        sesiones: [
          { sesion: { numeroSesion: 3, titulo: 'Tres' } },
          { sesion: { numeroSesion: 2, titulo: 'Dos' } },
        ],
      },
    ]);
    const r = await controller.disponibles(ESTUDIANTE);
    expect(r[0].sesiones).toEqual([
      { numeroSesion: 2, titulo: 'Dos' },
      { numeroSesion: 3, titulo: 'Tres' },
    ]);
  });

  it('sin vínculos → sesiones vacío', async () => {
    const { controller } = build([{ ...base, sesiones: [] }]);
    const r = await controller.disponibles(ESTUDIANTE);
    expect(r[0].sesiones).toEqual([]);
  });

  it('el select pide las sesiones ligadas', async () => {
    const { controller, prisma } = build([]);
    await controller.disponibles(ESTUDIANTE);
    const arg = prisma.plantillaFormulario.findMany.mock.calls[0][0];
    expect(arg.select.sesiones).toBeTruthy();
  });
});
