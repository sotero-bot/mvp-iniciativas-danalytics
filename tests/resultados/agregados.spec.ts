/**
 * Visibilidad de resultados (Plan 2 §2.4 — RF-33/34/35/36, RN-06/RN-09):
 * facilitador y cliente SOLO agregados (sin identificadores de respondiente),
 * feedback anónimo, admin con individuales + comparativo.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  agregarPorCampo,
  agregarScoresPorDimension,
} from '../../apps/api/src/modules/formularios/application/agregados';
import { ResultadosService } from '../../apps/api/src/modules/formularios/application/resultados.service';
import { FacilitadorResultadosController } from '../../apps/api/src/modules/formularios/interfaces/facilitador-resultados.controller';
import { ClienteResultadosController } from '../../apps/api/src/modules/formularios/interfaces/cliente-resultados.controller';
import { AppError } from '../../apps/api/src/shared/errors/AppError';

const FACILITADOR = { sub: 'fac1', role: 'facilitador', empresaId: null } as any;
const CLIENTE = { sub: 'cli1', role: 'cliente_admin', empresaId: 'emp1' } as any;

describe('agregarScoresPorDimension (RF-33)', () => {
  it('promedia los promedios individuales por dimensión', () => {
    const agregado = agregarScoresPorDimension([
      { adopcion: { total: 8, promedio: 4, respondidas: 2 } },
      { adopcion: { total: 4, promedio: 2, respondidas: 2 }, uso: { total: 3, promedio: 3, respondidas: 1 } },
      null,
    ]);
    expect(agregado).toEqual([
      { dimension: 'adopcion', promedio: 3, n: 2 },
      { dimension: 'uso', promedio: 3, n: 1 },
    ]);
  });
});

describe('agregarPorCampo — feedback anónimo (RF-36/RN-06)', () => {
  const campos = [
    { id: 'c1', tipoCampo: 'likert', etiqueta: 'Satisfacción', configJson: { min: 1, max: 5 } },
    { id: 'c2', tipoCampo: 'opcion_multiple', etiqueta: 'Formato', configJson: { opciones: [{ valor: 'v', etiqueta: 'Virtual', score: 1 }, { valor: 'p', etiqueta: 'Presencial' }] } },
    { id: 'c3', tipoCampo: 'texto_largo', etiqueta: 'Comentarios', configJson: {} },
  ] as any[];

  it('agrega promedio (likert), conteos (opciones) y textos sin autor', () => {
    const resultado = agregarPorCampo(campos, [
      { c1: 5, c2: 'v', c3: 'Muy bueno' },
      { c1: 3, c2: 'v', c3: 'Mejorable' },
    ]);
    expect(resultado[0]).toMatchObject({ promedio: 4, n: 2 });
    expect(resultado[1]).toMatchObject({
      opciones: [
        { valor: 'v', etiqueta: 'Virtual', conteo: 2 },
        { valor: 'p', etiqueta: 'Presencial', conteo: 0 },
      ],
    });
    expect(resultado[2]).toMatchObject({ textos: ['Muy bueno', 'Mejorable'] });

    // RN-06: nada en el agregado identifica al respondiente.
    const serializado = JSON.stringify(resultado);
    expect(serializado).not.toContain('usuario');
    expect(serializado).not.toContain('email');
  });
});

describe('ResultadosService (RF-34)', () => {
  function buildService(respuestasPorTipo: Record<string, any[]>) {
    const prisma = {
      respuestaFormulario: {
        findMany: vi.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(respuestasPorTipo[where.plantilla.tipoFormulario] ?? []),
        ),
      },
      campoFormulario: { findMany: vi.fn().mockResolvedValue([]) },
    };
    return new ResultadosService(prisma as any);
  }

  it('diagnosticoDetalle arma individuales + comparativo inicial vs final', async () => {
    const service = buildService({
      diagnostico_inicial: [
        {
          scoresPorDimensionJson: { adopcion: { total: 2, promedio: 2, respondidas: 1 } },
          enviadoEn: new Date('2026-01-01'),
          usuarioRespondiente: { id: 'u1', nombre: 'Ana', email: 'ana@x.co' },
        },
      ],
      diagnostico_final: [
        {
          scoresPorDimensionJson: { adopcion: { total: 4, promedio: 4, respondidas: 1 } },
          enviadoEn: new Date('2026-06-01'),
          usuarioRespondiente: { id: 'u1', nombre: 'Ana', email: 'ana@x.co' },
        },
      ],
    });

    const detalle = await service.diagnosticoDetalle('prog1');
    expect(detalle.inicial.individuales[0].usuario.nombre).toBe('Ana');
    expect(detalle.comparativo).toEqual([{ dimension: 'adopcion', inicial: 2, final: 4 }]);
  });

  it('diagnosticoAgregado NO incluye individuales ni usuarios (RF-33)', async () => {
    const service = buildService({
      diagnostico_inicial: [
        { scoresPorDimensionJson: { adopcion: { total: 2, promedio: 2, respondidas: 1 } } },
      ],
      diagnostico_final: [],
    });
    const agregado = await service.diagnosticoAgregado('prog1');
    expect(agregado.inicial.dimensiones).toEqual([{ dimension: 'adopcion', promedio: 2, n: 1 }]);
    const serializado = JSON.stringify(agregado);
    expect(serializado).not.toContain('usuario');
    expect(serializado).not.toContain('individuales');
  });
});

describe('Controllers de resultados — scoping (§0.1, RN-09)', () => {
  const resultadosMock = {
    diagnosticoAgregado: vi.fn().mockResolvedValue({ inicial: {}, final: {} }),
    feedbackAgregado: vi.fn().mockResolvedValue({ totalRespuestas: 0, campos: [] }),
  };

  it('facilitador: programa ajeno → 403 antes de consultar resultados', async () => {
    const scope = {
      assertProgramaAccessible: vi.fn().mockRejectedValue(new AppError('FORBIDDEN')),
    };
    const controller = new FacilitadorResultadosController(
      {} as any,
      scope as any,
      resultadosMock as any,
    );
    await expect(controller.diagnosticoAgregado('progAjeno', FACILITADOR)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(resultadosMock.diagnosticoAgregado).not.toHaveBeenCalled();
  });

  it('cliente: programa de otra empresa → 403 (RN-09)', async () => {
    const scope = {
      assertProgramaAccessible: vi.fn().mockRejectedValue(new AppError('FORBIDDEN')),
    };
    const controller = new ClienteResultadosController(
      {} as any,
      scope as any,
      resultadosMock as any,
    );
    await expect(controller.diagnosticoAgregado('progOtraEmpresa', CLIENTE)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('facilitador: programa propio → delega en ResultadosService', async () => {
    const scope = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined) };
    const feedback = vi.fn().mockResolvedValue({ totalRespuestas: 2, campos: [] });
    const controller = new FacilitadorResultadosController(
      {} as any,
      scope as any,
      { ...resultadosMock, feedbackAgregado: feedback } as any,
    );
    const result = await controller.feedbackAgregado('prog1', FACILITADOR);
    expect(result).toEqual({ totalRespuestas: 2, campos: [] });
    expect(scope.assertProgramaAccessible).toHaveBeenCalledWith({}, FACILITADOR, 'prog1');
  });
});
