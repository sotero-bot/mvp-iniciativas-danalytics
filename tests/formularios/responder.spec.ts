/**
 * Respuesta de formularios del estudiante (Plan 2 §2.3 — RF-28/RF-29, RNF-09):
 * draft/autosave, submit con score calculado SERVER-SIDE (el estudiante nunca lo
 * recibe), unicidad de respondiente (RESPUESTA_DUPLICADA / RESPUESTA_YA_ENVIADA).
 */

import { describe, it, expect, vi } from 'vitest';

import { EstudianteFormulariosController } from '../../apps/api/src/modules/formularios/interfaces/estudiante-formularios.controller';
import {
  calcularScoresPorDimension,
  scoreDeCampo,
} from '../../apps/api/src/modules/formularios/application/scoring';

const ACTOR = { sub: 'est1', role: 'estudiante', empresaId: null } as any;

const PLANTILLA = {
  id: 'pl1',
  programaId: 'prog1',
  tipoFormulario: 'diagnostico_inicial',
  nombre: 'Diagnóstico',
  descripcion: null,
  activa: true,
};

const CAMPOS = [
  { id: 'c1', tipoCampo: 'likert', dimension: 'adopcion', esObligatorio: true, campoPadreId: null, configJson: { min: 1, max: 5 } },
  { id: 'c2', tipoCampo: 'opcion_multiple', dimension: 'uso', esObligatorio: false, campoPadreId: null, configJson: { opciones: [{ valor: 'a', etiqueta: 'A', score: 2 }, { valor: 'b', etiqueta: 'B', score: 4 }], multiple: true } },
  { id: 'c3', tipoCampo: 'texto_largo', dimension: null, esObligatorio: false, campoPadreId: null, configJson: {} },
];

function buildController(overrides: Record<string, any> = {}) {
  const prisma = {
    plantillaFormulario: {
      findUnique: vi.fn().mockResolvedValue(PLANTILLA),
      findMany: vi.fn().mockResolvedValue([]),
    },
    campoFormulario: { findMany: vi.fn().mockResolvedValue(CAMPOS) },
    respuestaFormulario: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data })),
    },
    ...overrides.prisma,
  };
  const scope = {
    assertProgramaAccessible: vi.fn().mockResolvedValue(undefined),
    programaScope: vi.fn().mockReturnValue({}),
    ...overrides.scope,
  };
  const translations = { applyOverlay: vi.fn().mockResolvedValue({}) };
  return {
    controller: new EstudianteFormulariosController(prisma as any, scope as any, translations as any),
    prisma,
    scope,
  };
}

describe('scoring server-side (RF-29/RF-26)', () => {
  it('likert y numero puntúan el valor numérico', () => {
    expect(scoreDeCampo(CAMPOS[0] as any, 4)).toBe(4);
    expect(scoreDeCampo(CAMPOS[0] as any, '3')).toBe(3);
  });

  it('opcion_multiple suma el score de las opciones elegidas (multiple)', () => {
    expect(scoreDeCampo(CAMPOS[1] as any, ['a', 'b'])).toBe(6);
    expect(scoreDeCampo(CAMPOS[1] as any, 'b')).toBe(4);
  });

  it('valores no mapeables o vacíos no puntúan', () => {
    expect(scoreDeCampo(CAMPOS[1] as any, 'zzz')).toBeNull();
    expect(scoreDeCampo(CAMPOS[0] as any, '')).toBeNull();
  });

  it('agrega por dimensión con total/promedio/respondidas', () => {
    const scores = calcularScoresPorDimension(CAMPOS as any, { c1: 4, c2: ['a'], c3: 'texto' });
    expect(scores).toEqual({
      adopcion: { total: 4, promedio: 4, respondidas: 1 },
      uso: { total: 2, promedio: 2, respondidas: 1 },
    });
  });
});

describe('EstudianteFormulariosController.saveDraft (RNF-09)', () => {
  it('crea el draft si no existe (usuarioRespondienteId = actor)', async () => {
    const { controller, prisma } = buildController();
    await controller.saveDraft('pl1', { datos: { c1: 3 } }, ACTOR);
    expect(prisma.respuestaFormulario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plantillaId: 'pl1',
          programaId: 'prog1',
          usuarioRespondienteId: 'est1',
          estado: 'draft',
        }),
      }),
    );
  });

  it('actualiza el draft existente y registra ultimoEditorId', async () => {
    const { controller, prisma } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue({ id: 'r1', estado: 'draft' }),
          update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data })),
          create: vi.fn(),
        },
      },
    });
    await controller.saveDraft('pl1', { datos: { c1: 5 } }, ACTOR);
    expect(prisma.respuestaFormulario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ ultimoEditorId: 'est1' }),
      }),
    );
  });

  it('draft sobre respuesta enviada → RESPUESTA_YA_ENVIADA', async () => {
    const { controller } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue({ id: 'r1', estado: 'submitted' }),
          update: vi.fn(),
          create: vi.fn(),
        },
      },
    });
    await expect(controller.saveDraft('pl1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'RESPUESTA_YA_ENVIADA',
    });
  });

  it('carrera concurrente (P2002 del índice resp_form_usuario) → RESPUESTA_DUPLICADA', async () => {
    const { Prisma } = await import('@prisma/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { controller } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue(p2002),
          update: vi.fn(),
        },
      },
    });
    await expect(controller.saveDraft('pl1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'RESPUESTA_DUPLICADA',
    });
  });
});

describe('EstudianteFormulariosController.submit (RF-29)', () => {
  it('calcula scoresPorDimensionJson server-side y responde SOLO confirmación', async () => {
    const { controller, prisma } = buildController();
    const result = await controller.submit('pl1', { datos: { c1: 4, c2: ['a'] } }, ACTOR);

    const creado = (prisma.respuestaFormulario.create as any).mock.calls[0][0].data;
    expect(creado.estado).toBe('submitted');
    expect(creado.scoresPorDimensionJson).toEqual({
      adopcion: { total: 4, promedio: 4, respondidas: 1 },
      uso: { total: 2, promedio: 2, respondidas: 1 },
    });

    // El estudiante nunca ve scores ni desglose (RNF-04/RN-02).
    expect(result).toEqual({ ok: true, estado: 'submitted', enviadoEn: expect.any(Date) });
    expect(JSON.stringify(result)).not.toContain('score');
  });

  it('reenvío → RESPUESTA_YA_ENVIADA', async () => {
    const { controller } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue({ id: 'r1', estado: 'submitted' }),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    });
    await expect(controller.submit('pl1', {}, ACTOR)).rejects.toMatchObject({
      code: 'RESPUESTA_YA_ENVIADA',
    });
  });

  it('obligatorios sin responder → VALIDATION_ERROR (RF-25)', async () => {
    const { controller } = buildController();
    await expect(controller.submit('pl1', { datos: { c2: ['a'] } }, ACTOR)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('usa el draft guardado si el submit no trae datos', async () => {
    const { controller, prisma } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'r1',
            estado: 'draft',
            datosRespuestaJson: { c1: 5 },
          }),
          update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data })),
          create: vi.fn(),
        },
      },
    });
    await controller.submit('pl1', {}, ACTOR);
    const actualizado = (prisma.respuestaFormulario.update as any).mock.calls[0][0].data;
    expect(actualizado.scoresPorDimensionJson).toEqual({
      adopcion: { total: 5, promedio: 5, respondidas: 1 },
    });
  });
});

describe('EstudianteFormulariosController — acceso (§0.1)', () => {
  it('plantilla global (sin programaId) no es respondible → PLANTILLA_NOT_FOUND', async () => {
    const { controller } = buildController({
      prisma: {
        plantillaFormulario: {
          findUnique: vi.fn().mockResolvedValue({ ...PLANTILLA, programaId: null }),
          findMany: vi.fn(),
        },
      },
    });
    await expect(controller.saveDraft('pl1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'PLANTILLA_NOT_FOUND',
    });
  });

  it('programa de otro estudiante → propaga el 403 del scoping', async () => {
    const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
    const { controller } = buildController({
      scope: {
        assertProgramaAccessible: vi.fn().mockRejectedValue(new AppError('FORBIDDEN')),
      },
    });
    await expect(controller.submit('pl1', { datos: { c1: 1 } }, ACTOR)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('tipos grupales (bitacora) no se responden por esta vía → FORBIDDEN', async () => {
    const { controller } = buildController({
      prisma: {
        plantillaFormulario: {
          findUnique: vi.fn().mockResolvedValue({ ...PLANTILLA, tipoFormulario: 'bitacora' }),
          findMany: vi.fn(),
        },
      },
    });
    await expect(controller.saveDraft('pl1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
