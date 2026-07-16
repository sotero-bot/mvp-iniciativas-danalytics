/**
 * Lectura del facilitador (Plan 2 §3.1 — RF-37/RF-38): bitácoras y plantillas
 * de proyecto de TODOS los grupos de su programa, en SOLO lectura, escopeado
 * por assertProgramaAccessible y sin configJson (RNF-04).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { FacilitadorRetoController } from '../../apps/api/src/modules/reto/interfaces/facilitador-reto.controller';

const ACTOR = { sub: 'fac1', role: 'facilitador', empresaId: null } as any;

const PLANTILLA_BITACORA = {
  id: 'plb1',
  tipoFormulario: 'bitacora',
  nombre: 'Bitácora del reto',
  descripcion: null,
};

const CAMPOS = [
  {
    id: 'c1',
    campoPadreId: null,
    tipoCampo: 'opcion_multiple',
    etiqueta: 'Herramienta',
    descripcion: null,
    esObligatorio: false,
    orden: 1,
    configJson: { opciones: [{ valor: 'gpt', etiqueta: 'ChatGPT', score: 5 }] },
  },
];

const GRUPOS = [
  {
    id: 'g1',
    nombre: 'Grupo 1',
    orden: 1,
    miembros: [{ usuario: { id: 'est1', nombre: 'Ana' } }],
    respuestasFormulario: [
      {
        datosRespuestaJson: { c1: 'gpt' },
        ultimaEdicionEn: new Date('2026-07-05'),
        ultimoEditor: { id: 'est1', nombre: 'Ana' },
      },
    ],
  },
  { id: 'g2', nombre: 'Grupo 2', orden: 2, miembros: [], respuestasFormulario: [] },
];

function buildController(overrides: Record<string, any> = {}) {
  const prisma = {
    plantillaFormulario: { findFirst: vi.fn().mockResolvedValue(PLANTILLA_BITACORA) },
    campoFormulario: { findMany: vi.fn().mockResolvedValue(CAMPOS) },
    grupo: { findMany: vi.fn().mockResolvedValue(GRUPOS) },
    ...overrides.prisma,
  };
  const scope = {
    assertProgramaAccessible: vi.fn().mockResolvedValue(undefined),
    ...overrides.scope,
  };
  const translations = { applyOverlay: vi.fn().mockResolvedValue({}) };
  return {
    controller: new FacilitadorRetoController(prisma as any, scope as any, translations as any),
    prisma,
    scope,
  };
}

describe('Autorización (§0.1, RF-37/RF-38)', () => {
  it('FacilitadorRetoController declara @Roles(facilitador)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorRetoController)).toEqual(['facilitador']);
  });

  it('lectura de bitácoras/plantillas; la única escritura es habilitar la bitácora (O-01)', () => {
    const handlers = Object.getOwnPropertyNames(FacilitadorRetoController.prototype).filter(
      n => n !== 'constructor',
    );
    // RF-37/38 siguen siendo solo lectura; estadoBitacora (GET) + habilitarBitacora (POST)
    // son el toggle de visibilidad de la bitácora que el cliente pidió (O-01).
    expect(handlers.sort()).toEqual([
      'estadoBitacora',
      'habilitarBitacora',
      'listBitacoras',
      'listPlantillas',
      'listRecurso',
    ]);
  });

  it('programa de otro facilitador → propaga el 403 del scoping (RNF-02)', async () => {
    const { AppError } = await import('../../apps/api/src/shared/errors/AppError');
    const { controller } = buildController({
      scope: { assertProgramaAccessible: vi.fn().mockRejectedValue(new AppError('FORBIDDEN')) },
    });
    await expect(controller.listBitacoras('prog-ajeno', ACTOR)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('GET /facilitador/programas/:id/bitacoras (RF-37)', () => {
  it('devuelve la plantilla + todos los grupos con su respuesta y último editor', async () => {
    const { controller, scope } = buildController();
    const result = await controller.listBitacoras('prog1', ACTOR);

    expect(scope.assertProgramaAccessible).toHaveBeenCalledWith(expect.anything(), ACTOR, 'prog1');
    expect(result.plantilla?.tipoFormulario).toBe('bitacora');
    expect(result.grupos).toHaveLength(2);
    expect(result.grupos[0].respuesta).toMatchObject({
      datos: { c1: 'gpt' },
      ultimoEditor: { nombre: 'Ana' },
    });
    expect(result.grupos[1].respuesta).toBeNull();
  });

  it('nunca serializa configJson ni score (RNF-04/RN-02)', async () => {
    const { controller } = buildController();
    const result = await controller.listBitacoras('prog1', ACTOR);
    const json = JSON.stringify(result);
    expect(json).not.toContain('configJson');
    expect(json).not.toContain('score');
    expect(result.plantilla?.campos[0].configPublica).toEqual({
      opciones: [{ valor: 'gpt', etiqueta: 'ChatGPT' }],
      multiple: false,
    });
  });

  it('programa sin snapshot de bitácora → { plantilla: null, grupos: [] } (sin error)', async () => {
    const { controller } = buildController({
      prisma: { plantillaFormulario: { findFirst: vi.fn().mockResolvedValue(null) } },
    });
    const result = await controller.listBitacoras('prog1', ACTOR);
    expect(result).toEqual({ plantilla: null, grupos: [] });
  });
});

describe('GET /facilitador/programas/:id/plantillas (RF-38)', () => {
  it('consulta el snapshot de tipo plantilla_proyecto', async () => {
    const { controller, prisma } = buildController({
      prisma: {
        plantillaFormulario: {
          findFirst: vi.fn().mockResolvedValue({ ...PLANTILLA_BITACORA, id: 'plp1', tipoFormulario: 'plantilla_proyecto' }),
        },
      },
    });
    const result = await controller.listPlantillas('prog1', ACTOR);
    expect(prisma.plantillaFormulario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ programaId: 'prog1', tipoFormulario: 'plantilla_proyecto', activa: true }),
      }),
    );
    expect(result.plantilla?.tipoFormulario).toBe('plantilla_proyecto');
  });
});
