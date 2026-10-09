/**
 * HU-12 — `GET programas/:id/resumen`: nombre, fase y docentes (con correo) del programa.
 */

import { describe, it, expect, vi } from 'vitest';
import 'reflect-metadata';

import { ActorSesionesController } from '../../apps/api/src/modules/sesiones/interfaces/actor-sesiones.controller';
import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { AppError } from '../../apps/api/src/shared/errors/AppError';

const ESTUDIANTE = { sub: 'e1', userId: 'e1', role: 'estudiante' as const, empresaId: null };

const FACILITADOR = { sub: 'f1', userId: 'f1', role: 'facilitador' as const, empresaId: null };

const pasado = new Date(Date.now() - 10 * 86_400_000);
const futuro = new Date(Date.now() + 10 * 86_400_000);

function programaBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    nombre: 'Programa 1',
    descripcion: 'Desc',
    estado: 'activo',
    timezone: 'America/Bogota',
    fechaInicio: pasado,
    fechaFin: futuro,
    totalSesionesEsperadas: null,
    bitacoraHabilitadaEn: null,
    presentacionDesdeSesion: null,
    empresa: { id: 'emp1', nombre: 'Acme' },
    facilitadores: [{ usuario: { id: 'f1', nombre: 'Faci Uno', email: 'faci@x.co' } }],
    sesiones: [
      { numeroSesion: 1, titulo: 'S1', fechaProgramada: pasado },
      { numeroSesion: 2, titulo: 'S2', fechaProgramada: futuro },
    ],
    ...overrides,
  };
}

function buildController(programa: unknown = programaBase(), grupos: unknown[] = []) {
  const prismaMock = {
    programa: { findUnique: vi.fn().mockResolvedValue(programa) },
    grupo: { findMany: vi.fn().mockResolvedValue(grupos) },
  };
  const scopeStub = {
    assertProgramaAccessible: vi.fn().mockResolvedValue(undefined),
    assertProgramaEditable: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new ActorSesionesController(prismaMock as any, scopeStub as any, {} as any);
  return { controller, prismaMock, scopeStub };
}

describe('ActorSesionesController.resumenPrograma (HU-12)', () => {
  it('es alcanzable por facilitador y estudiante (roles de la clase)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ActorSesionesController)).toEqual(['facilitador', 'estudiante']);
    expect(Reflect.getMetadata(ROLES_KEY, ActorSesionesController.prototype.resumenPrograma)).toBeUndefined();
  });

  it('usa assertProgramaAccessible (lectura), no assertProgramaEditable', async () => {
    const { controller, scopeStub } = buildController();
    await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(scopeStub.assertProgramaAccessible).toHaveBeenCalledWith(expect.anything(), ESTUDIANTE, 'p1');
    expect(scopeStub.assertProgramaEditable).not.toHaveBeenCalled();
  });

  it('programa fuera de scope → propaga el 403 y no consulta datos', async () => {
    const { controller, prismaMock, scopeStub } = buildController();
    scopeStub.assertProgramaAccessible.mockRejectedValue(new AppError('FORBIDDEN'));
    await expect(controller.resumenPrograma('p1', ESTUDIANTE)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.programa.findUnique).not.toHaveBeenCalled();
  });

  it('PROGRAMA_NOT_FOUND si el programa desaparece tras el scope', async () => {
    const { controller } = buildController(null);
    await expect(controller.resumenPrograma('p1', ESTUDIANTE)).rejects.toMatchObject({
      code: 'PROGRAMA_NOT_FOUND',
    });
  });

  it('incluye facilitadores[].email', async () => {
    const { controller } = buildController();
    const r = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.facilitadores).toEqual([{ id: 'f1', nombre: 'Faci Uno', email: 'faci@x.co' }]);
  });

  it('email null en BD se serializa como null y no revienta', async () => {
    const { controller } = buildController(
      programaBase({ facilitadores: [{ usuario: { id: 'f2', nombre: 'Sin Correo', email: null } }] }),
    );
    const r = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.facilitadores).toEqual([{ id: 'f2', nombre: 'Sin Correo', email: null }]);
  });

  it('sesionesTotal usa totalSesionesEsperadas cuando existe', async () => {
    const { controller } = buildController(programaBase({ totalSesionesEsperadas: 8 }));
    const r = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.sesionesTotal).toBe(8);
    expect(r.sesionesRealizadas).toBe(1);
  });

  it('sesionesTotal cae a sesiones.length si no hay totalSesionesEsperadas', async () => {
    const { controller } = buildController();
    const r = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.sesionesTotal).toBe(2);
  });

  it('proximaSesion es la primera sesión futura (o null)', async () => {
    const { controller } = buildController();
    const r = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.proximaSesion).toMatchObject({ numeroSesion: 2, titulo: 'S2' });

    const { controller: c2 } = buildController(programaBase({ sesiones: [] }));
    expect((await c2.resumenPrograma('p1', ESTUDIANTE)).proximaSesion).toBeNull();
  });

  it('trae fase { fase, clave } y los datos básicos del programa', async () => {
    const { controller } = buildController();
    const r = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.fase).toEqual({ fase: expect.any(Number), clave: expect.any(String) });
    expect(r).toMatchObject({
      id: 'p1',
      nombre: 'Programa 1',
      empresa: { id: 'emp1', nombre: 'Acme' },
      estado: 'activo',
      timezone: 'America/Bogota',
    });
  });
});

// HU-03 — bloque `retos`. RN-07: el estudiante ve ESTADO de entrega, nunca el trabajo ajeno.
describe('ActorSesionesController.resumenPrograma — bloque retos (HU-03)', () => {
  const entrega = new Date('2026-09-01T10:00:00Z');
  const grupos = [
    {
      id: 'g1',
      nombre: 'Grupo 1',
      orden: 1,
      _count: { miembros: 3 },
      miembros: [{ id: 'm1' }], // el estudiante e1 pertenece a g1
      presentacionFinal: {
        entregadoEn: entrega,
        urlPresentacion: 'https://drive.example/secreto-g1',
        archivoKey: 'secreto/g1/archivo.pdf',
      },
    },
    {
      id: 'g2',
      nombre: 'Grupo 2',
      orden: 2,
      _count: { miembros: 4 },
      miembros: [],
      presentacionFinal: {
        entregadoEn: entrega,
        urlPresentacion: null,
        archivoKey: 'secreto/g2/archivo.pdf',
      },
    },
    {
      id: 'g3',
      nombre: 'Grupo 3',
      orden: 3,
      _count: { miembros: 2 },
      miembros: [],
      presentacionFinal: null,
    },
  ];

  it('estudiante: el JSON serializado no contiene urlPresentacion, conArchivo ni archivoKey', async () => {
    const { controller } = buildController(programaBase(), grupos);
    const json = JSON.stringify(await controller.resumenPrograma('p1', ESTUDIANTE));
    expect(json).not.toContain('urlPresentacion');
    expect(json).not.toContain('conArchivo');
    expect(json).not.toContain('archivoKey');
    expect(json).not.toContain('secreto');
  });

  it('facilitador: ve urlPresentacion y conArchivo, nunca archivoKey', async () => {
    const { controller } = buildController(programaBase(), grupos);
    const resultado = await controller.resumenPrograma('p1', FACILITADOR);
    const json = JSON.stringify(resultado);
    expect(json).toContain('urlPresentacion');
    expect(json).toContain('conArchivo');
    expect(json).not.toContain('archivoKey');
    expect(json).not.toContain('secreto/g');
    const [g1, g2, g3] = (resultado as any).retos.grupos;
    expect(g1).toMatchObject({ urlPresentacion: 'https://drive.example/secreto-g1', conArchivo: true });
    expect(g2).toMatchObject({ urlPresentacion: null, conArchivo: true });
    expect(g3).toMatchObject({ urlPresentacion: null, conArchivo: false });
  });

  it('cuenta totalGrupos y entregados (solo con presentacionFinal)', async () => {
    const { controller } = buildController(programaBase(), grupos);
    const r: any = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.retos.totalGrupos).toBe(3);
    expect(r.retos.entregados).toBe(2);
    expect(r.retos.grupos.map((g: any) => [g.id, g.entregada, g.miembros])).toEqual([
      ['g1', true, 3],
      ['g2', true, 4],
      ['g3', false, 2],
    ]);
    expect(r.retos.grupos[2].entregadoEn).toBeNull();
    expect(r.retos.grupos[0].entregadoEn).toEqual(entrega);
  });

  it('esMiGrupo es true solo en el grupo del estudiante; en facilitador siempre false', async () => {
    const { controller } = buildController(programaBase(), grupos);
    const est: any = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(est.retos.grupos.map((g: any) => g.esMiGrupo)).toEqual([true, false, false]);
    const fac: any = await controller.resumenPrograma('p1', FACILITADOR);
    expect(fac.retos.grupos.map((g: any) => g.esMiGrupo)).toEqual([false, false, false]);
  });

  it('programa sin grupos → { totalGrupos: 0, entregados: 0, grupos: [] }', async () => {
    const { controller } = buildController(programaBase(), []);
    const r: any = await controller.resumenPrograma('p1', ESTUDIANTE);
    expect(r.retos).toEqual({ totalGrupos: 0, entregados: 0, grupos: [] });
  });
});
