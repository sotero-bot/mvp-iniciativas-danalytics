/**
 * HU-14: el cliente consulta el catálogo de áreas de SU empresa (solo lectura).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../apps/api/src/modules/auth/guards/auth-user';
import { PortalAreasController } from '../../apps/api/src/modules/portal/interfaces/portal-areas.controller';
import { PortalProgramasController } from '../../apps/api/src/modules/portal/interfaces/portal-programas.controller';
import { contarParticipantesPorArea } from '../../apps/api/src/modules/portal/application/participantes-por-area';

const ACTOR = { sub: 'cli1', role: 'cliente_admin', empresaId: 'emp1' } as any;

function build() {
  const prisma = { areaEmpresa: { findMany: vi.fn().mockResolvedValue([]) } };
  return { controller: new PortalAreasController(prisma as any), prisma };
}

describe('GET portal/areas', () => {
  it('acota por la empresa del JWT y solo áreas activas, con _count de usuarios', async () => {
    const { controller, prisma } = build();
    await controller.list(ACTOR);
    const arg = prisma.areaEmpresa.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ empresaId: 'emp1', activo: true });
    expect(arg.select._count).toEqual({ select: { usuarios: true } });
  });

  it('actor sin empresaId en el JWT → PORTAL_ACCESO_DENEGADO y no consulta', async () => {
    const { controller, prisma } = build();
    await expect(controller.list({ sub: 'x', role: 'cliente_admin' } as any)).rejects.toMatchObject({
      code: 'PORTAL_ACCESO_DENEGADO',
      statusCode: 403,
    });
    expect(prisma.areaEmpresa.findMany).not.toHaveBeenCalled();
  });

  it('declara @Roles(...CLIENTE_ROLE_SLUGS)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PortalAreasController)).toEqual([...CLIENTE_ROLE_SLUGS]);
  });

  it('es solo lectura: único handler list', () => {
    const handlers = Object.getOwnPropertyNames(PortalAreasController.prototype).filter(n => n !== 'constructor');
    expect(handlers).toEqual(['list']);
  });
});

describe('contarParticipantesPorArea (función pura)', () => {
  const p = (areaCatalogo: { id: string; nombre: string } | null) => ({ usuario: { areaCatalogo } });

  it('agrega por área, ordena por nombre y deja "Sin área" (areaId null) al final', () => {
    const r = contarParticipantesPorArea([
      p({ id: 'a2', nombre: 'Operaciones' }),
      p(null),
      p({ id: 'a1', nombre: 'Diseño' }),
      p({ id: 'a2', nombre: 'Operaciones' }),
      p(null),
      p(null),
    ]);
    expect(r).toEqual([
      { areaId: 'a1', nombre: 'Diseño', participantes: 1 },
      { areaId: 'a2', nombre: 'Operaciones', participantes: 2 },
      { areaId: null, nombre: null, participantes: 3 },
    ]);
  });

  it('sin participantes → []; sin "Sin área" si todos tienen área', () => {
    expect(contarParticipantesPorArea([])).toEqual([]);
    expect(contarParticipantesPorArea([p({ id: 'a1', nombre: 'Diseño' })])).toEqual([
      { areaId: 'a1', nombre: 'Diseño', participantes: 1 },
    ]);
  });
});

describe('GET portal/programas/:id — participantesPorArea', () => {
  function buildDetalle(participantes: any[]) {
    const prisma = {
      programa: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'prog1', nombre: 'P', descripcion: null, estado: 'activo', fechaInicio: null, fechaFin: null,
          totalSesionesEsperadas: null, facilitadores: [],
        }),
      },
      sesion: { findMany: vi.fn().mockResolvedValue([]) },
      participantePrograma: {
        count: vi.fn().mockResolvedValue(participantes.length),
        findMany: vi.fn().mockResolvedValue(participantes),
      },
      asistencia: { findMany: vi.fn().mockResolvedValue([]) },
      grupo: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const resultados = { diagnosticoAgregado: vi.fn().mockResolvedValue({}), feedbackAgregado: vi.fn().mockResolvedValue({}) };
    return { controller: new PortalProgramasController(prisma as any, resultados as any), prisma };
  }

  it('agrega sobre los participantes ACTIVOS del programa', async () => {
    const { controller, prisma } = buildDetalle([
      { usuario: { areaCatalogo: { id: 'a1', nombre: 'Diseño' } } },
      { usuario: { areaCatalogo: null } },
    ]);
    const r: any = await controller.detalle('prog1', ACTOR);
    expect(prisma.participantePrograma.findMany.mock.calls[0][0].where).toEqual({ programaId: 'prog1', activo: true });
    expect(r.participantesPorArea).toEqual([
      { areaId: 'a1', nombre: 'Diseño', participantes: 1 },
      { areaId: null, nombre: null, participantes: 1 },
    ]);
  });

  it('no filtra el scoping: el programa ajeno sigue dando PORTAL_ACCESO_DENEGADO sin consultar participantes', async () => {
    const { controller, prisma } = buildDetalle([]);
    prisma.programa.findFirst.mockResolvedValue(null);
    await expect(controller.detalle('ajeno', ACTOR)).rejects.toMatchObject({ code: 'PORTAL_ACCESO_DENEGADO' });
    expect(prisma.participantePrograma.findMany).not.toHaveBeenCalled();
  });
});
