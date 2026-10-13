/**
 * HU-02 — la fase del programa se expone en `GET /estudiante/resumen` y `GET /programas`.
 * La lógica pura vive en tests/programas/fase.spec.ts; aquí solo la integración.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';

vi.mock('../../apps/api/src/modules/programas/application/fase-programa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../apps/api/src/modules/programas/application/fase-programa')>();
  const derivarFasePrograma = vi.fn((...args: Parameters<typeof actual.derivarFasePrograma>) =>
    actual.derivarFasePrograma(...args),
  );
  return { ...actual, derivarFasePrograma };
});

import { ActorSesionesController } from '../../apps/api/src/modules/sesiones/interfaces/actor-sesiones.controller';
import { PendientesEstudianteService } from '../../apps/api/src/modules/sesiones/application/pendientes-estudiante.service';
import { derivarFasePrograma } from '../../apps/api/src/modules/programas/application/fase-programa';

const ESTUDIANTE = { sub: 'e1', userId: 'e1', role: 'estudiante' as const, empresaId: null };
const FACILITADOR = { sub: 'f1', userId: 'f1', role: 'facilitador' as const, empresaId: null };

const futuro = new Date(Date.now() + 30 * 86_400_000);

function programaBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    nombre: 'Programa 1',
    timezone: 'America/Bogota',
    totalSesionesEsperadas: null,
    bitacoraHabilitadaEn: null,
    presentacionDesdeSesion: null,
    empresa: { id: 'emp1', nombre: 'Acme' },
    sesiones: [
      {
        numeroSesion: 1,
        titulo: 'S1',
        fechaProgramada: futuro,
        urlPresentacion: null,
        presentacionArchivoKey: null,
        urlGrabacion: null,
      },
    ],
    grupos: [],
    ...overrides,
  };
}

function buildController(programas: unknown[]) {
  const prismaMock = {
    programa: { findMany: vi.fn().mockResolvedValue(programas) },
    plantillaFormulario: { findMany: vi.fn().mockResolvedValue([]) },
    participantePrograma: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const scopeStub = { programaScope: vi.fn().mockReturnValue({}), graciaVencida: vi.fn().mockReturnValue(false) };
  const pendientes = new PendientesEstudianteService(prismaMock as any, scopeStub as any);
  const controller = new ActorSesionesController(prismaMock as any, scopeStub as any, {} as any, pendientes);
  return { controller, prismaMock };
}

beforeEach(() => {
  vi.mocked(derivarFasePrograma).mockClear();
});

describe('GET /estudiante/resumen — fase (HU-02)', () => {
  it('cada programa trae fase: { fase, clave }', async () => {
    const { controller } = buildController([programaBase()]);
    const result = await controller.resumenEstudiante(ESTUDIANTE);
    expect(result.programas[0]).toMatchObject({ fase: { fase: 1, clave: 'entendimiento' } });
  });

  it('el select del programa incluye presentacionDesdeSesion', async () => {
    const { controller, prismaMock } = buildController([programaBase()]);
    await controller.resumenEstudiante(ESTUDIANTE);
    const arg = prismaMock.programa.findMany.mock.calls[0][0];
    expect(arg.select.presentacionDesdeSesion).toBe(true);
  });

  it('grupo del estudiante con presentacionFinal → fase 3 aunque la bitácora no esté habilitada', async () => {
    const grupo = {
      nombre: 'G1',
      _count: { miembros: 3 },
      respuestasFormulario: [],
      presentacionFinal: { entregadoEn: new Date() },
    };
    const { controller } = buildController([programaBase({ grupos: [grupo] })]);
    const result = await controller.resumenEstudiante(ESTUDIANTE);
    expect(result.programas[0].fase).toEqual({ fase: 3, clave: 'presentacion_final' });
  });

  it('sin presentacionFinal en el grupo no se fuerza la fase 3', async () => {
    const grupo = { nombre: 'G1', _count: { miembros: 3 }, respuestasFormulario: [], presentacionFinal: null };
    const { controller } = buildController([programaBase({ grupos: [grupo] })]);
    const result = await controller.resumenEstudiante(ESTUDIANTE);
    expect(result.programas[0].fase.fase).toBe(1);
  });
});

describe('GET /estudiante/resumen — grupo finalizado (HU-23)', () => {
  const grupoFinalizado = {
    nombre: 'G1',
    _count: { miembros: 3 },
    respuestasFormulario: [],
    presentacionFinal: null,
    finalizadoEn: new Date('2026-10-01'),
  };

  it('grupo finalizado → fase 3 completada, aunque no haya entrega ni bitácora', async () => {
    const { controller } = buildController([programaBase({ grupos: [grupoFinalizado] })]);
    const result = await controller.resumenEstudiante(ESTUDIANTE);
    expect(result.programas[0].fase).toEqual({ fase: 3, clave: 'presentacion_final', completada: true });
  });

  it('el select del grupo incluye finalizadoEn', async () => {
    const { controller, prismaMock } = buildController([programaBase()]);
    await controller.resumenEstudiante(ESTUDIANTE);
    const arg = prismaMock.programa.findMany.mock.calls[0][0];
    expect(arg.select.grupos.select.finalizadoEn).toBe(true);
  });

  it('un grupo finalizado no genera entregable pendiente y su reto es finalizado', async () => {
    const { controller } = buildController([programaBase({ bitacoraHabilitadaEn: new Date('2026-07-01'), grupos: [grupoFinalizado] })]);
    const result = await controller.resumenEstudiante(ESTUDIANTE);
    expect(result.pendientes.filter((p: any) => p.tipo === 'entregable')).toEqual([]);
    expect(result.programas[0].reto).toBe('finalizado');
  });
});

describe('GET /programas — fase (HU-02)', () => {
  it('trae fase y pasa hayPresentacionEntregada: false (vista de programa, no de grupo)', async () => {
    const { controller, prismaMock } = buildController([
      { id: 'p1', nombre: 'P1', bitacoraHabilitadaEn: null, presentacionDesdeSesion: null, sesiones: [], grupos: [] },
    ]);
    const result = await controller.listMisProgramas(FACILITADOR);
    expect(result[0]).toMatchObject({ fase: { fase: 1, clave: 'entendimiento' }, soloLectura: false });
    expect(vi.mocked(derivarFasePrograma).mock.calls[0][0]).toMatchObject({ hayPresentacionEntregada: false });

    const select = prismaMock.programa.findMany.mock.calls[0][0].select;
    expect(select.bitacoraHabilitadaEn).toBe(true);
    expect(select.presentacionDesdeSesion).toBe(true);
    expect(select.sesiones).toEqual({ select: { numeroSesion: true, fechaProgramada: true } });
  });

  it('bitácora habilitada → fase 3', async () => {
    const { controller } = buildController([
      { id: 'p1', nombre: 'P1', bitacoraHabilitadaEn: new Date(), presentacionDesdeSesion: null, sesiones: [], grupos: [] },
    ]);
    const result = await controller.listMisProgramas(FACILITADOR);
    expect(result[0].fase.fase).toBe(3);
  });
});
