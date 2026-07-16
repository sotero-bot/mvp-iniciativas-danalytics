/**
 * Bitácora del grupo (Plan 2 §3.1 — RF-16/RF-30, RNF-04/RNF-09):
 * solo miembros del grupo editan (GRUPO_RECURSO_NO_MIEMBRO), el draft grupal
 * registra ultimoEditorId/ultimaEdicionEn y los campos viajan SIN configJson.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { GrupoRecursosController } from '../../apps/api/src/modules/reto/interfaces/grupo-recursos.controller';

const ACTOR = { sub: 'est1', role: 'estudiante', empresaId: null } as any;

const GRUPO = {
  id: 'g1',
  programaId: 'prog1',
  nombre: 'Grupo 1',
  orden: 1,
  programa: {
    id: 'prog1',
    nombre: 'Programa IA',
    estado: 'activo',
    presentacionDesdeSesion: null,
    bitacoraHabilitadaEn: new Date('2026-07-01'), // O-01: bitácora habilitada para estos tests
    empresa: { nombre: 'Acme Corp' },
  },
};

const PLANTILLA_BITACORA = {
  id: 'plb1',
  programaId: 'prog1',
  tipoFormulario: 'bitacora',
  nombre: 'Bitácora del reto',
  descripcion: null,
};

const CAMPOS = [
  {
    id: 'c1',
    campoPadreId: null,
    tipoCampo: 'grupo_repetible',
    etiqueta: 'Iteraciones',
    descripcion: null,
    esObligatorio: false,
    orden: 1,
    configJson: {},
  },
  {
    id: 'c2',
    campoPadreId: 'c1',
    tipoCampo: 'opcion_multiple',
    etiqueta: 'Herramienta',
    descripcion: null,
    esObligatorio: false,
    orden: 2,
    configJson: { opciones: [{ valor: 'gpt', etiqueta: 'ChatGPT', score: 3 }] },
  },
];

function buildController(overrides: Record<string, any> = {}) {
  const prisma = {
    grupo: {
      findUnique: vi.fn().mockResolvedValue(GRUPO),
      findMany: vi.fn().mockResolvedValue([]),
    },
    miembroGrupo: { findFirst: vi.fn().mockResolvedValue({ id: 'm1' }) },
    plantillaFormulario: { findFirst: vi.fn().mockResolvedValue(PLANTILLA_BITACORA) },
    campoFormulario: { findMany: vi.fn().mockResolvedValue(CAMPOS) },
    respuestaFormulario: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data })),
    },
    presentacionFinal: { findUnique: vi.fn().mockResolvedValue(null) },
    sesion: { findFirst: vi.fn().mockResolvedValue(null) },
    ...overrides.prisma,
  };
  const scope = {
    assertProgramaAccessible: vi.fn().mockResolvedValue(undefined),
    programaScope: vi.fn().mockReturnValue({}),
    ...overrides.scope,
  };
  const translations = { applyOverlay: vi.fn().mockResolvedValue({}) };
  const s3 = { isConfigured: true };
  return {
    controller: new GrupoRecursosController(prisma as any, scope as any, translations as any, s3 as any),
    prisma,
    scope,
  };
}

describe('Autorización (§0.1)', () => {
  it('GrupoRecursosController declara @Roles(estudiante)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, GrupoRecursosController)).toEqual(['estudiante']);
  });

  it('no-miembro del grupo → GRUPO_RECURSO_NO_MIEMBRO (RF-16)', async () => {
    const { controller } = buildController({
      prisma: { miembroGrupo: { findFirst: vi.fn().mockResolvedValue(null) } },
    });
    await expect(controller.getBitacora('g1', ACTOR)).rejects.toMatchObject({
      code: 'GRUPO_RECURSO_NO_MIEMBRO',
    });
    await expect(controller.saveBitacoraDraft('g1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'GRUPO_RECURSO_NO_MIEMBRO',
    });
  });

  it('grupo inexistente → GRUPO_NOT_FOUND', async () => {
    const { controller } = buildController({
      prisma: { grupo: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn() } },
    });
    await expect(controller.getBitacora('nope', ACTOR)).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
  });

  it('programa de otro estudiante → propaga el 403 del scoping', async () => {
    const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
    const { controller } = buildController({
      scope: { assertProgramaAccessible: vi.fn().mockRejectedValue(new AppError('FORBIDDEN')) },
    });
    await expect(controller.getBitacora('g1', ACTOR)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('GET bitácora (RF-30, RNF-04)', () => {
  it('devuelve campos SIN configJson ni score, con configPublica', async () => {
    const { controller } = buildController();
    const result = await controller.getBitacora('g1', ACTOR);
    const json = JSON.stringify(result);
    expect(json).not.toContain('configJson');
    expect(json).not.toContain('score');
    expect(result.campos[1].configPublica).toEqual({
      opciones: [{ valor: 'gpt', etiqueta: 'ChatGPT' }],
      multiple: false,
    });
  });

  it('incluye la respuesta grupal con ultimoEditor (RF-16)', async () => {
    const { controller } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue({
            estado: 'draft',
            datosRespuestaJson: { c1: [{ c2: 'gpt' }] },
            ultimaEdicionEn: new Date('2026-07-01'),
            ultimoEditor: { id: 'est2', nombre: 'Otro Miembro' },
          }),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    });
    const result = await controller.getBitacora('g1', ACTOR);
    expect(result.respuesta?.ultimoEditor).toEqual({ id: 'est2', nombre: 'Otro Miembro' });
    expect(result.respuesta?.datos).toEqual({ c1: [{ c2: 'gpt' }] });
  });

  it('programa sin snapshot de bitácora → PLANTILLA_NOT_FOUND', async () => {
    const { controller } = buildController({
      prisma: { plantillaFormulario: { findFirst: vi.fn().mockResolvedValue(null) } },
    });
    await expect(controller.getBitacora('g1', ACTOR)).rejects.toMatchObject({ code: 'PLANTILLA_NOT_FOUND' });
  });
});

describe('PUT bitácora/draft (RF-16/RF-30/RNF-09)', () => {
  it('crea el draft con grupoRespondienteId (no usuario) y registra ultimoEditorId', async () => {
    const { controller, prisma } = buildController();
    await controller.saveBitacoraDraft('g1', { datos: { c1: [{ c2: 'gpt' }] } }, ACTOR);
    expect(prisma.respuestaFormulario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plantillaId: 'plb1',
          programaId: 'prog1',
          grupoRespondienteId: 'g1',
          estado: 'draft',
          ultimoEditorId: 'est1',
          ultimaEdicionEn: expect.any(Date),
        }),
      }),
    );
    const data = (prisma.respuestaFormulario.create as any).mock.calls[0][0].data;
    expect(data.usuarioRespondienteId).toBeUndefined();
  });

  it('agrega iteraciones sobre el draft existente (siempre editable, sin submit)', async () => {
    const { controller, prisma } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
          update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data })),
          create: vi.fn(),
        },
      },
    });
    await controller.saveBitacoraDraft('g1', { datos: { c1: [{ c2: 'gpt' }, { c2: 'gpt' }] } }, ACTOR);
    expect(prisma.respuestaFormulario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          datosRespuestaJson: { c1: [{ c2: 'gpt' }, { c2: 'gpt' }] },
          ultimoEditorId: 'est1',
        }),
      }),
    );
  });

  it('carrera concurrente (P2002 del índice resp_form_grupo) → RESPUESTA_DUPLICADA', async () => {
    const { Prisma } = await import('@prisma/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
    const { controller } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue(p2002),
          update: vi.fn(),
        },
      },
    });
    await expect(controller.saveBitacoraDraft('g1', { datos: {} }, ACTOR)).rejects.toMatchObject({
      code: 'RESPUESTA_DUPLICADA',
    });
  });
});
