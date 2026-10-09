/**
 * Fase 4 (Plan 2 §4.1/§4.5 — RF-42/RF-43/RN-09): el portal del cliente es SOLO
 * lectura y está acotado a la empresa del JWT. Forjar el id de un programa de
 * otra empresa devuelve 403 (PORTAL_ACCESO_DENEGADO).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../apps/api/src/modules/auth/guards/auth-user';
import { PortalProgramasController } from '../../apps/api/src/modules/portal/interfaces/portal-programas.controller';
import { AdminAsistenciaController } from '../../apps/api/src/modules/asistencia/interfaces/admin-asistencia.controller';
import { PortalUsuariosClienteController } from '../../apps/api/src/modules/portal/interfaces/portal-usuarios-cliente.controller';

const ACTOR_CLIENTE = { sub: 'cli1', role: 'cliente_admin', empresaId: 'emp1' } as any;
const ACTOR_USUARIO_CLIENTE = { sub: 'uc1', role: 'usuario_cliente', empresaId: 'emp1' } as any;

const PROGRAMA = {
  id: 'prog1',
  nombre: 'Programa IA',
  descripcion: null,
  estado: 'activo',
  fechaInicio: new Date('2026-06-01'),
  fechaFin: new Date('2026-08-01'),
  totalSesionesEsperadas: null,
  facilitadores: [{ usuario: { nombre: 'Facilitadora' } }], // C-01: N:M
};

function buildController(overrides: Record<string, any> = {}) {
  const prisma = {
    programa: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(PROGRAMA),
    },
    iniciativa: { findMany: vi.fn().mockResolvedValue([]) },
    sesion: { findMany: vi.fn().mockResolvedValue([{ id: 's1', numeroSesion: 1, titulo: 'S1', fechaProgramada: new Date(), estado: 'completada' }]) },
    participantePrograma: { count: vi.fn().mockResolvedValue(4) },
    asistencia: { findMany: vi.fn().mockResolvedValue([{ presente: true }, { presente: false }]) },
    grupo: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides.prisma,
  };
  const resultados = {
    diagnosticoAgregado: vi.fn().mockResolvedValue({ inicial: { totalRespuestas: 0, dimensiones: [] }, final: { totalRespuestas: 0, dimensiones: [] } }),
    feedbackAgregado: vi.fn().mockResolvedValue({ totalRespuestas: 0, campos: [] }),
    ...overrides.resultados,
  };
  return { controller: new PortalProgramasController(prisma as any, resultados as any), prisma, resultados };
}

describe('Autorización (§0.1, RF-42/RF-43)', () => {
  it('PortalProgramasController declara @Roles(cliente_admin, usuario_cliente)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PortalProgramasController)).toEqual([...CLIENTE_ROLE_SLUGS]);
  });

  it('el portal de programas es SOLO lectura: no expone handlers de escritura', () => {
    const handlers = Object.getOwnPropertyNames(PortalProgramasController.prototype).filter(
      n => n !== 'constructor',
    );
    // detalle/listPrograms son los únicos GET; requireEmpresa es un helper privado
    // (el filtro C-07 vive ahora en portal/application/cliente-scope.ts).
    expect(handlers.sort()).toEqual(['detalle', 'listPrograms', 'requireEmpresa']);
  });

  it('la gestión de usuarios-cliente es EXCLUSIVA de cliente_admin', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PortalUsuariosClienteController)).toEqual(['cliente_admin']);
  });
});

describe('GET /portal/programas (RF-42, RN-09)', () => {
  it('cliente_admin: acota por empresa (ve TODOS los programas de su empresa, RN-09)', async () => {
    const { controller, prisma } = buildController();
    await controller.listPrograms(ACTOR_CLIENTE);
    expect(prisma.programa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 'emp1' } }),
    );
    expect(prisma.iniciativa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ empresaId: 'emp1' }) }),
    );
  });

  it('usuario_cliente: además de la empresa, solo los programas asignados (C-07)', async () => {
    const { controller, prisma } = buildController();
    await controller.listPrograms(ACTOR_USUARIO_CLIENTE);
    expect(prisma.programa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 'emp1', asignacionesCliente: { some: { usuarioId: 'uc1' } } },
      }),
    );
    // Decisión IA NO se restringe por asignación (O-02): sigue acotada solo por empresa.
    expect(prisma.iniciativa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ empresaId: 'emp1' }) }),
    );
  });

  it('unifica ambos módulos en la respuesta', async () => {
    const { controller } = buildController({
      prisma: {
        programa: {
          findMany: vi.fn().mockResolvedValue([
            { ...PROGRAMA, _count: { participantes: 5, sesiones: 6 } },
          ]),
          findFirst: vi.fn(),
        },
        iniciativa: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'ini1', nombre: 'Iniciativa', descripcion: null, createdAt: new Date(),
              actividades: [{ id: 'a1', instancias: [{ estado: 'finalizada' }, { estado: 'en_progreso' }] }],
            },
          ]),
        },
      },
    });
    const result = await controller.listPrograms(ACTOR_CLIENTE);
    expect(result.iaEnAccion[0]).toMatchObject({ modulo: 'ia_en_accion', id: 'prog1', participantes: 5 });
    expect(result.decisionIa[0]).toMatchObject({
      modulo: 'decision_ia', id: 'ini1', actividades: 1, instanciasTotal: 2, instanciasFinalizadas: 1,
    });
  });

  it('actor sin empresaId en el JWT → PORTAL_ACCESO_DENEGADO', async () => {
    const { controller } = buildController();
    await expect(controller.listPrograms({ sub: 'x', role: 'cliente_admin', empresaId: null } as any))
      .rejects.toMatchObject({ code: 'PORTAL_ACCESO_DENEGADO', statusCode: 403 });
  });
});

describe('GET /portal/programas/:id (RF-43, RN-09)', () => {
  it('programa de OTRA empresa (o inexistente) → 403 PORTAL_ACCESO_DENEGADO', async () => {
    const { controller, prisma } = buildController({
      prisma: { programa: { findMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) } },
    });
    await expect(controller.detalle('prog-ajeno', ACTOR_USUARIO_CLIENTE)).rejects.toMatchObject({
      code: 'PORTAL_ACCESO_DENEGADO',
      statusCode: 403,
    });
    expect(prisma.programa.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { id: 'prog-ajeno' },
            { empresaId: 'emp1', asignacionesCliente: { some: { usuarioId: 'uc1' } } },
          ],
        },
      }),
    );
  });

  it('devuelve avance, asistencia, diagnóstico agregado, proyecto y feedback', async () => {
    const { controller, resultados } = buildController({
      prisma: {
        grupo: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'g1', nombre: 'Grupo 1', orden: 1, _count: { miembros: 3 },
              presentacionFinal: { urlPresentacion: 'https://slides', archivoKey: null, entregadoEn: new Date('2026-07-01') },
            },
            { id: 'g2', nombre: 'Grupo 2', orden: 2, _count: { miembros: 2 }, presentacionFinal: null },
          ]),
        },
      },
    });
    const result = await controller.detalle('prog1', ACTOR_USUARIO_CLIENTE);
    expect(result.avance).toEqual({ sesionesCompletadas: 1, sesionesTotales: 1, participantesActivos: 4 });
    expect(result.asistencia.porcentajePromedio).toBe(0.5);
    expect(result.proyecto[0].presentacion).toMatchObject({ entregada: true, urlPresentacion: 'https://slides' });
    expect(result.proyecto[1].presentacion).toEqual({ entregada: false });
    expect(resultados.diagnosticoAgregado).toHaveBeenCalledWith('prog1');
    expect(resultados.feedbackAgregado).toHaveBeenCalledWith('prog1');
  });

  it('nunca expone la key S3 de la presentación (RN-07: cliente no descarga)', async () => {
    const { controller } = buildController({
      prisma: {
        grupo: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'g1', nombre: 'Grupo 1', orden: 1, _count: { miembros: 3 },
              presentacionFinal: { urlPresentacion: null, archivoKey: 'emp/prog/grupo_1/presentacion_final/x.pdf', entregadoEn: new Date() },
            },
          ]),
        },
      },
    });
    const result = await controller.detalle('prog1', ACTOR_CLIENTE);
    expect(JSON.stringify(result)).not.toContain('archivoKey');
    expect(result.proyecto[0].presentacion).toMatchObject({ entregada: true, conArchivo: true });
  });
});

// Plan 0 §2 (C-07): GET admin/programas/:id/asistencia/resumen debe aplicar el mismo scope
// que el portal. El prisma falso EVALÚA el `where` (empresa + asignaciones): un mock que lo
// ignorara no podría cazar el defecto original, que solo comparaba empresaId.
describe('AdminAsistenciaController.resumen — scoping C-07', () => {
  const ASIGNADOS = new Set(['uc-asignado']);
  const DANALYTICS_ADMIN = { sub: 'adm', role: 'danalytics_admin', empresaId: null } as any;
  const UC_ASIGNADO = { sub: 'uc-asignado', role: 'usuario_cliente', empresaId: 'emp1' } as any;
  const UC_SIN_ASIGNAR = { sub: 'uc-libre', role: 'usuario_cliente', empresaId: 'emp1' } as any;
  const CLIENTE_ADMIN = { sub: 'cli1', role: 'cliente_admin', empresaId: 'emp1' } as any;
  const CLIENTE_OTRA = { sub: 'cli2', role: 'cliente_admin', empresaId: 'emp2' } as any;
  const FILA = { id: 'prog1', empresaId: 'emp1' };

  const coincide = (where: any): boolean => {
    if (!where) return true;
    if (where.AND) return where.AND.every(coincide);
    if (where.id !== undefined && where.id !== FILA.id) return false;
    if (where.empresaId !== undefined && where.empresaId !== FILA.empresaId) return false;
    const some = where.asignacionesCliente?.some;
    if (some && !ASIGNADOS.has(some.usuarioId)) return false;
    return true;
  };

  function build() {
    const prisma = {
      programa: {
        findUnique: vi.fn().mockResolvedValue(FILA),
        findFirst: vi.fn(async ({ where }: any) => (coincide(where) ? FILA : null)),
      },
    };
    const resumen = { build: vi.fn().mockResolvedValue({ filas: [] }) };
    return { controller: new AdminAsistenciaController(prisma as any, resumen as any), resumen };
  }

  it('usuario_cliente CON asignación → 200', async () => {
    const { controller, resumen } = build();
    await expect(controller.resumen('prog1', UC_ASIGNADO)).resolves.toEqual({ filas: [] });
    expect(resumen.build).toHaveBeenCalledWith('prog1');
  });

  it('usuario_cliente SIN asignación, programa de su empresa → PORTAL_ACCESO_DENEGADO (regresión C-07)', async () => {
    const { controller, resumen } = build();
    await expect(controller.resumen('prog1', UC_SIN_ASIGNAR)).rejects.toMatchObject({
      code: 'PORTAL_ACCESO_DENEGADO',
    });
    expect(resumen.build).not.toHaveBeenCalled(); // no se filtran nombres ni correos
  });

  it('cliente_admin, programa de su empresa → 200', async () => {
    const { controller } = build();
    await expect(controller.resumen('prog1', CLIENTE_ADMIN)).resolves.toEqual({ filas: [] });
  });

  it('cliente_admin, programa de otra empresa → PORTAL_ACCESO_DENEGADO', async () => {
    const { controller } = build();
    await expect(controller.resumen('prog1', CLIENTE_OTRA)).rejects.toMatchObject({
      code: 'PORTAL_ACCESO_DENEGADO',
    });
  });

  it('danalytics_admin, cualquier programa → 200', async () => {
    const { controller } = build();
    await expect(controller.resumen('prog1', DANALYTICS_ADMIN)).resolves.toEqual({ filas: [] });
  });
});
