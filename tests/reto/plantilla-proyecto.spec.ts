/**
 * Plantilla del proyecto del grupo (Plan 2 §3.1 — RF-31):
 * editable siempre, campos `tabla` con filas dinámicas, misma regla de
 * membresía que la bitácora.
 */

import { describe, it, expect, vi } from 'vitest';

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
    empresa: { nombre: 'Acme Corp' },
  },
};

const PLANTILLA_PROYECTO = {
  id: 'plp1',
  programaId: 'prog1',
  tipoFormulario: 'plantilla_proyecto',
  nombre: 'Plantilla del proyecto',
  descripcion: null,
};

const CAMPOS = [
  {
    id: 't1',
    campoPadreId: null,
    tipoCampo: 'tabla',
    etiqueta: 'Equipo',
    descripcion: null,
    esObligatorio: false,
    orden: 1,
    configJson: { columnas: ['Rol', 'Nombre'] },
  },
];

function buildController(overrides: Record<string, any> = {}) {
  const prisma = {
    grupo: { findUnique: vi.fn().mockResolvedValue(GRUPO), findMany: vi.fn() },
    miembroGrupo: { findFirst: vi.fn().mockResolvedValue({ id: 'm1' }) },
    plantillaFormulario: { findFirst: vi.fn().mockResolvedValue(PLANTILLA_PROYECTO) },
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
  const s3 = { isConfigured: true };
  return {
    controller: new GrupoRecursosController(prisma as any, scope as any, translations as any, s3 as any),
    prisma,
  };
}

describe('GET plantilla-proyecto (RF-31)', () => {
  it('resuelve el snapshot de tipo plantilla_proyecto del programa del grupo', async () => {
    const { controller, prisma } = buildController();
    const result = await controller.getPlantillaProyecto('g1', ACTOR);
    expect(prisma.plantillaFormulario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ programaId: 'prog1', tipoFormulario: 'plantilla_proyecto', activa: true }),
      }),
    );
    expect(result.tipoFormulario).toBe('plantilla_proyecto');
    // La tabla expone sus columnas vía configPublica (sin configJson).
    expect(result.campos[0].configPublica).toEqual({ columnas: ['Rol', 'Nombre'] });
    expect(JSON.stringify(result)).not.toContain('configJson');
  });

  it('no-miembro → GRUPO_RECURSO_NO_MIEMBRO', async () => {
    const { controller } = buildController({
      prisma: { miembroGrupo: { findFirst: vi.fn().mockResolvedValue(null) } },
    });
    await expect(controller.getPlantillaProyecto('g1', ACTOR)).rejects.toMatchObject({
      code: 'GRUPO_RECURSO_NO_MIEMBRO',
    });
  });
});

describe('PUT plantilla-proyecto/draft — filas dinámicas (RF-31)', () => {
  it('persiste filas de tabla agregadas dinámicamente', async () => {
    const filas = [
      { Rol: 'Líder', Nombre: 'Ana' },
      { Rol: 'Analista', Nombre: 'Luis' },
    ];
    const { controller, prisma } = buildController();
    await controller.savePlantillaProyectoDraft('g1', { datos: { t1: filas } }, ACTOR);
    expect(prisma.respuestaFormulario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plantillaId: 'plp1',
          grupoRespondienteId: 'g1',
          datosRespuestaJson: { t1: filas },
        }),
      }),
    );
  });

  it('editar de nuevo elimina/actualiza filas (editable siempre) y registra al editor', async () => {
    const { controller, prisma } = buildController({
      prisma: {
        respuestaFormulario: {
          findFirst: vi.fn().mockResolvedValue({ id: 'r1' }),
          update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data })),
          create: vi.fn(),
        },
      },
    });
    await controller.savePlantillaProyectoDraft('g1', { datos: { t1: [{ Rol: 'Líder', Nombre: 'Ana' }] } }, ACTOR);
    const data = (prisma.respuestaFormulario.update as any).mock.calls[0][0].data;
    expect(data.datosRespuestaJson).toEqual({ t1: [{ Rol: 'Líder', Nombre: 'Ana' }] });
    expect(data.ultimoEditorId).toBe('est1');
    expect(data.ultimaEdicionEn).toBeInstanceOf(Date);
  });
});
