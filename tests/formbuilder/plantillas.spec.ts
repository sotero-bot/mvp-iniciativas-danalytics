/**
 * Form builder (Plan 2 §2.1 — RF-22/23/24/25/26): CRUD de plantillas y campos,
 * inmutabilidad con respuestas (PLANTILLA_INMUTABLE), duplicado versionado,
 * reorden en lote y validación de config por tipo (CAMPO_CONFIG_INVALIDA).
 */

import { describe, it, expect, vi } from 'vitest';

import { AdminFormulariosController } from '../../apps/api/src/modules/formularios/interfaces/admin-formularios.controller';
import { validarConfigCampo } from '../../apps/api/src/modules/formularios/application/form-config';

const ACTOR = { sub: 'admin1', role: 'danalytics_admin', empresaId: null } as any;

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    plantillaFormulario: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'pl1',
        programaId: null,
        version: 1,
        activa: true,
        _count: { respuestas: 0 },
        campos: [],
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'pl1', ...data })),
    },
    campoFormulario: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })),
      delete: vi.fn().mockResolvedValue({}),
    },
    programa: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) },
    $transaction: vi.fn().mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') {
        // callback-style: se le pasa el propio mock como tx
        return arg(prismaSelf());
      }
      return Promise.all(arg);
    }),
    ...overrides,
  };
}

// $transaction(callback) necesita una referencia al mock ya construido.
let _prisma: any;
function prismaSelf() {
  return _prisma;
}
function buildController(overrides: Record<string, unknown> = {}, snapshots: any = {}) {
  _prisma = buildPrismaMock(overrides);
  return {
    controller: new AdminFormulariosController(_prisma as any, snapshots),
    prisma: _prisma,
  };
}

describe('validarConfigCampo (RF-24, CAMPO_CONFIG_INVALIDA)', () => {
  it('opcion_multiple sin opciones → CAMPO_CONFIG_INVALIDA', () => {
    expect(() => validarConfigCampo('opcion_multiple' as any, {})).toThrowError(
      expect.objectContaining({ code: 'CAMPO_CONFIG_INVALIDA' }),
    );
  });

  it('opcion_multiple con opciones válidas (score numérico opcional) pasa', () => {
    const config = validarConfigCampo('opcion_multiple' as any, {
      opciones: [{ valor: 'a', etiqueta: 'A', score: 2 }],
      multiple: true,
    });
    expect(config.opciones).toHaveLength(1);
  });

  it('likert con min >= max → CAMPO_CONFIG_INVALIDA', () => {
    expect(() => validarConfigCampo('likert' as any, { min: 5, max: 1 })).toThrowError(
      expect.objectContaining({ code: 'CAMPO_CONFIG_INVALIDA' }),
    );
  });

  it('tabla sin columnas → CAMPO_CONFIG_INVALIDA', () => {
    expect(() => validarConfigCampo('tabla' as any, { columnas: [] })).toThrowError(
      expect.objectContaining({ code: 'CAMPO_CONFIG_INVALIDA' }),
    );
  });

  it('texto_corto sin config pasa', () => {
    expect(validarConfigCampo('texto_corto' as any, undefined)).toEqual({});
  });
});

describe('AdminFormulariosController — inmutabilidad (RF-23/RF-47)', () => {
  it('PATCH de contenido con respuestas → PLANTILLA_INMUTABLE', async () => {
    const { controller } = buildController({
      plantillaFormulario: {
        findUnique: vi.fn().mockResolvedValue({ id: 'pl1', _count: { respuestas: 3 } }),
        update: vi.fn(),
      },
    });
    await expect(controller.updatePlantilla('pl1', { nombre: 'Nuevo' })).rejects.toMatchObject({
      code: 'PLANTILLA_INMUTABLE',
    });
  });

  it('PATCH solo de "activa" con respuestas SÍ se permite (retirar versión)', async () => {
    const { controller } = buildController({
      plantillaFormulario: {
        findUnique: vi.fn().mockResolvedValue({ id: 'pl1', _count: { respuestas: 3 } }),
        update: vi.fn().mockResolvedValue({ id: 'pl1', activa: false }),
      },
    });
    const result = await controller.updatePlantilla('pl1', { activa: false });
    expect(result).toMatchObject({ activa: false });
  });

  it('crear campo en plantilla con respuestas → PLANTILLA_INMUTABLE', async () => {
    const { controller } = buildController({
      plantillaFormulario: {
        findUnique: vi.fn().mockResolvedValue({ id: 'pl1', _count: { respuestas: 1 } }),
      },
    });
    await expect(
      controller.createCampo('pl1', { tipoCampo: 'texto_corto' as any, etiqueta: 'X' }),
    ).rejects.toMatchObject({ code: 'PLANTILLA_INMUTABLE' });
  });

  it('borrar campo de plantilla con respuestas → PLANTILLA_INMUTABLE', async () => {
    const { controller } = buildController({
      campoFormulario: {
        findUnique: vi.fn().mockResolvedValue({ id: 'c1', plantillaId: 'pl1' }),
        delete: vi.fn(),
      },
      plantillaFormulario: {
        findUnique: vi.fn().mockResolvedValue({ id: 'pl1', _count: { respuestas: 1 } }),
      },
    });
    await expect(controller.deleteCampo('c1')).rejects.toMatchObject({
      code: 'PLANTILLA_INMUTABLE',
    });
  });
});

describe('AdminFormulariosController — duplicar (RF-23)', () => {
  it('duplicar crea version+1, desactiva el original global y copia campos', async () => {
    const campos = [
      { id: 'c1', campoPadreId: null, tipoCampo: 'grupo_repetible', etiqueta: 'G', descripcion: null, dimension: null, esObligatorio: false, orden: 1, configJson: {} },
      { id: 'c2', campoPadreId: 'c1', tipoCampo: 'texto_corto', etiqueta: 'H', descripcion: null, dimension: null, esObligatorio: false, orden: 2, configJson: {} },
    ];
    const creates: any[] = [];
    const update = vi.fn().mockResolvedValue({});
    const { controller } = buildController({
      plantillaFormulario: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'pl1',
          programaId: null,
          tipoFormulario: 'diagnostico_inicial',
          nombre: 'Diag',
          descripcion: null,
          version: 2,
          campos,
        }),
        update,
        create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data })),
      },
      campoFormulario: {
        create: vi.fn().mockImplementation(({ data }: any) => {
          creates.push(data);
          return Promise.resolve(data);
        }),
      },
    });

    const copia = await controller.duplicarPlantilla('pl1', ACTOR);
    expect(copia).toMatchObject({ version: 3, activa: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pl1' }, data: { activa: false } }),
    );
    expect(creates).toHaveLength(2);
    // La jerarquía padre-hijo se re-mapea a los ids nuevos (no apunta al original).
    const hijo = creates.find(c => c.etiqueta === 'H');
    const padre = creates.find(c => c.etiqueta === 'G');
    expect(hijo.campoPadreId).toBe(padre.id);
    expect(hijo.campoPadreId).not.toBe('c1');
  });
});

describe('AdminFormulariosController — campos y reorden (RF-24)', () => {
  it('createCampo valida config por tipo → CAMPO_CONFIG_INVALIDA', async () => {
    const { controller } = buildController();
    await expect(
      controller.createCampo('pl1', {
        tipoCampo: 'opcion_multiple' as any,
        etiqueta: 'Pregunta',
        configJson: {},
      }),
    ).rejects.toMatchObject({ code: 'CAMPO_CONFIG_INVALIDA' });
  });

  it('campoPadreId debe apuntar a un grupo_repetible de la misma plantilla', async () => {
    const { controller } = buildController({
      campoFormulario: {
        findUnique: vi.fn().mockResolvedValue({ id: 'c9', plantillaId: 'pl1', tipoCampo: 'texto_corto' }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    });
    await expect(
      controller.createCampo('pl1', {
        tipoCampo: 'texto_corto' as any,
        etiqueta: 'Hijo',
        campoPadreId: 'c9',
      }),
    ).rejects.toMatchObject({ code: 'CAMPO_CONFIG_INVALIDA' });
  });

  it('reorden con id ajeno a la plantilla → CAMPO_NOT_FOUND', async () => {
    const { controller } = buildController({
      campoFormulario: {
        findMany: vi.fn().mockResolvedValue([{ id: 'c1' }]),
        update: vi.fn(),
      },
    });
    await expect(
      controller.reordenarCampos('pl1', { orden: [{ id: 'c1', orden: 1 }, { id: 'ajeno', orden: 2 }] }),
    ).rejects.toMatchObject({ code: 'CAMPO_NOT_FOUND' });
  });

  it('reorden actualiza cada campo en lote', async () => {
    const update = vi.fn().mockImplementation((args: any) => Promise.resolve(args));
    const { controller } = buildController({
      campoFormulario: {
        findMany: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
        update,
      },
    });
    const result = await controller.reordenarCampos('pl1', {
      orden: [{ id: 'c1', orden: 2 }, { id: 'c2', orden: 1 }],
    });
    expect(result).toEqual({ actualizados: 2 });
    expect(update).toHaveBeenCalledTimes(2);
  });
});
