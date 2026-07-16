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
    // detalle/listPrograms son los únicos GET; filtroProgramas/requireEmpresa son helpers privados.
    expect(handlers.sort()).toEqual(['detalle', 'filtroProgramas', 'listPrograms', 'requireEmpresa']);
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
