/**
 * HU-13 — pendientes del estudiante divididos por sesión.
 * `GET estudiante/programas/:id/pendientes` agrupa los mismos pendientes que `/estudiante/resumen`.
 */

import { describe, it, expect, vi } from 'vitest';
import 'reflect-metadata';

import { ActorSesionesController } from '../../apps/api/src/modules/sesiones/interfaces/actor-sesiones.controller';
import { PendientesEstudianteService } from '../../apps/api/src/modules/sesiones/application/pendientes-estudiante.service';
import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';

const ESTUDIANTE = { sub: 'e1', userId: 'e1', role: 'estudiante' as const, empresaId: null };

const pasado = new Date(Date.now() - 30 * 86_400_000);
const futuro = new Date(Date.now() + 30 * 86_400_000);

function sesion(numeroSesion: number, fechaProgramada = futuro) {
  return {
    numeroSesion,
    titulo: `Sesión ${numeroSesion}`,
    fechaProgramada,
    urlPresentacion: null,
    presentacionArchivoKey: null,
    urlGrabacion: null,
  };
}

function programa(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    nombre: 'Programa 1',
    timezone: 'America/Bogota',
    totalSesionesEsperadas: null,
    bitacoraHabilitadaEn: null,
    presentacionDesdeSesion: null,
    empresa: { id: 'emp1', nombre: 'Acme' },
    sesiones: [sesion(1, pasado), sesion(2), sesion(3)],
    grupos: [],
    ...overrides,
  };
}

// Vínculos N:M SesionFormulario tal como los devuelve el select anidado del servicio.
function enSesiones(...numeros: number[]) {
  return numeros.map((n) => ({
    sesion: { numeroSesion: n, titulo: `Sesión ${n}`, fechaProgramada: n === 1 ? pasado : futuro },
  }));
}

function plantilla(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pl-fb',
    nombre: 'Feedback',
    programaId: 'p1',
    tipoFormulario: 'feedback',
    sesiones: [],
    programa: { id: 'p1', nombre: 'Programa 1' },
    respuestas: [],
    ...overrides,
  };
}

function build(opts: { programas?: unknown[]; plantillas?: unknown[]; matriculas?: unknown[]; accesoDenegado?: boolean } = {}) {
  const prisma = {
    programa: { findMany: vi.fn().mockResolvedValue(opts.programas ?? [programa()]), findFirst: vi.fn() },
    plantillaFormulario: { findMany: vi.fn().mockResolvedValue(opts.plantillas ?? []) },
    participantePrograma: { findMany: vi.fn().mockResolvedValue(opts.matriculas ?? []) },
  };
  const scope = {
    programaScope: vi.fn().mockReturnValue({}),
    assertProgramaAccessible: opts.accesoDenegado
      ? vi.fn().mockRejectedValue({ code: 'FORBIDDEN' })
      : vi.fn().mockResolvedValue(undefined),
  };
  const service = new PendientesEstudianteService(prisma as any, scope as any);
  const controller = new ActorSesionesController(prisma as any, scope as any, {} as any, service);
  return { controller, prisma, scope };
}

describe('GET estudiante/programas/:id/pendientes — agrupación (HU-13)', () => {
  it('REGRESIÓN: el diagnostico_inicial de programa queda excluido; el resto sí se lista', async () => {
    // Si el refactor pierde la exclusión, el snapshot aparecería como pendiente para siempre.
    const encuesta = plantilla({ id: 'pl-enc', nombre: 'Encuesta', programaId: null, tipoFormulario: 'diagnostico_inicial', programa: null });
    const snapshotDiag = plantilla({ id: 'pl-diag', nombre: 'Diag programa', tipoFormulario: 'diagnostico_inicial' });
    const feedback = plantilla({ id: 'pl-fb' });
    const { controller } = build({ plantillas: [encuesta, snapshotDiag, feedback] });

    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    const ids = r.generales.map((p: any) => p.plantillaId);
    expect(ids).toContain('pl-enc');
    expect(ids).toContain('pl-fb');
    expect(ids).not.toContain('pl-diag');
    expect(r.total).toBe(2);
  });

  it('formulario ligado a la sesión 2 → porSesion', async () => {
    const { controller } = build({ plantillas: [plantilla({ sesiones: enSesiones(2) })] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.generales).toEqual([]);
    expect(r.porSesion).toHaveLength(1);
    expect(r.porSesion[0]).toMatchObject({ numeroSesion: 2, titulo: 'Sesión 2', realizada: false });
    expect(r.porSesion[0].items[0]).toMatchObject({ plantillaId: 'pl-fb', sesiones: [{ numeroSesion: 2 }] });
  });

  it('formulario sin sesiones → generales', async () => {
    const { controller } = build({ plantillas: [plantilla()] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion).toEqual([]);
    expect(r.generales).toHaveLength(1);
  });

  it('encuesta_inicio → siempre generales', async () => {
    const encuesta = plantilla({ id: 'pl-enc', programaId: null, tipoFormulario: 'diagnostico_inicial', sesiones: enSesiones(2), programa: null });
    const { controller } = build({ plantillas: [encuesta] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion).toEqual([]);
    expect(r.generales).toMatchObject([{ tipo: 'encuesta_inicio', sesiones: [] }]);
  });

  it('matricula → siempre generales', async () => {
    const { controller } = build({ matriculas: [{ programa: { id: 'p2', nombre: 'Otro' } }] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion).toEqual([]);
    expect(r.generales).toMatchObject([{ tipo: 'matricula', programaId: 'p2', sesiones: [] }]);
  });

  it('entregable → siempre generales', async () => {
    const grupo = { nombre: 'G1', _count: { miembros: 3 }, respuestasFormulario: [], presentacionFinal: null, finalizadoEn: null };
    const { controller } = build({ programas: [programa({ bitacoraHabilitadaEn: new Date('2026-07-01'), grupos: [grupo] })] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion).toEqual([]);
    expect(r.generales).toMatchObject([{ tipo: 'entregable', programaId: 'p1', sesiones: [] }]);
  });

  it('una sesión sin pendientes no aparece en porSesion', async () => {
    const { controller } = build({ plantillas: [plantilla({ sesiones: enSesiones(2) })] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion.map((s: any) => s.numeroSesion)).toEqual([2]);
  });

  it('porSesion va ordenado por numeroSesion ascendente y marca realizada', async () => {
    const { controller } = build({
      plantillas: [
        plantilla({ id: 'a', sesiones: enSesiones(3) }),
        plantilla({ id: 'b', sesiones: enSesiones(1) }),
        plantilla({ id: 'c', sesiones: enSesiones(2) }),
      ],
    });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion.map((s: any) => s.numeroSesion)).toEqual([1, 2, 3]);
    expect(r.porSesion[0].realizada).toBe(true); // sesión 1 en el pasado
    expect(r.porSesion[1].realizada).toBe(false);
  });

  it('N:M: un formulario ligado a varias sesiones aparece en cada una', async () => {
    const { controller } = build({ plantillas: [plantilla({ sesiones: enSesiones(3, 2) })] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion.map((s: any) => s.numeroSesion)).toEqual([2, 3]);
    expect(r.porSesion.every((s: any) => s.items[0].plantillaId === 'pl-fb')).toBe(true);
    expect(r.generales).toEqual([]);
  });

  it('total cuenta cada pendiente UNA vez aunque salga en varias sesiones', async () => {
    const encuesta = plantilla({ id: 'pl-enc', programaId: null, tipoFormulario: 'diagnostico_inicial', programa: null });
    const { controller } = build({
      plantillas: [
        encuesta,
        plantilla({ id: 'a', sesiones: enSesiones(2, 3) }),
        plantilla({ id: 'b', sesiones: enSesiones(2) }),
        plantilla({ id: 'c' }),
      ],
    });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.porSesion.find((s: any) => s.numeroSesion === 2).items).toHaveLength(2);
    expect(r.generales).toHaveLength(2); // encuesta + c
    expect(r.total).toBe(4); // enc, a, b, c — no 5
  });

  it('un formulario ya enviado no es pendiente', async () => {
    const enviado = plantilla({ sesiones: enSesiones(2), respuestas: [{ estado: 'submitted' }] });
    const { controller } = build({ plantillas: [enviado] });
    const r = await controller.pendientesPrograma('p1', ESTUDIANTE);
    expect(r.total).toBe(0);
  });

  it('metadata de roles: solo estudiante', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ActorSesionesController.prototype.pendientesPrograma)).toEqual(['estudiante']);
  });

  it('programa ajeno → 403 (FORBIDDEN) y no consulta pendientes', async () => {
    const { controller, prisma } = build({ accesoDenegado: true });
    await expect(controller.pendientesPrograma('ajeno', ESTUDIANTE)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.plantillaFormulario.findMany).not.toHaveBeenCalled();
  });
});
