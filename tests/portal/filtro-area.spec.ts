/**
 * HU-14: el selector de área del detalle del programa (portal cliente) filtra TODA la página:
 * participantes, asistencia (indicador y matriz), grupos, diagnóstico y feedback.
 * Como el feedback es anónimo (RF-33/RN-06), un agregado con menos de MIN_RESPUESTAS_ANONIMAS
 * respuestas se oculta para que un área pequeña no revele respuestas individuales.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import {
  filtroUsuarioPorArea,
  protegerAnonimato,
  MIN_RESPUESTAS_ANONIMAS,
  SIN_AREA,
} from '../../apps/api/src/modules/portal/application/filtro-area';
import { PortalProgramasController } from '../../apps/api/src/modules/portal/interfaces/portal-programas.controller';
import { AsistenciaResumenService } from '../../apps/api/src/modules/asistencia/application/asistencia-resumen.service';
import { AdminAsistenciaController } from '../../apps/api/src/modules/asistencia/interfaces/admin-asistencia.controller';
import { ResultadosService } from '../../apps/api/src/modules/formularios/application/resultados.service';

const ACTOR = { sub: 'cli1', role: 'cliente_admin', empresaId: 'emp1' } as any;
const VACIO = { escala: [], seleccion: [] };

describe('filtroUsuarioPorArea', () => {
  it('sin valor → sin filtro', () => {
    expect(filtroUsuarioPorArea(undefined)).toBeUndefined();
    expect(filtroUsuarioPorArea('')).toBeUndefined();
  });
  it('SIN_AREA → usuarios sin área', () => {
    expect(filtroUsuarioPorArea(SIN_AREA)).toEqual({ areaId: null });
  });
  it('id → ese área', () => {
    expect(filtroUsuarioPorArea('a1')).toEqual({ areaId: 'a1' });
  });
});

describe('protegerAnonimato', () => {
  const agg = (totalRespuestas: number) => ({ totalRespuestas, dimensiones: { escala: [{ x: 1 }], seleccion: [] } });
  const vacio = { dimensiones: { escala: [], seleccion: [] } };

  it('sin filtro → pasa tal cual (el programa completo no se oculta)', () => {
    const a = agg(1);
    expect(protegerAnonimato(a, false, vacio)).toBe(a);
  });
  it('con filtro y 0 respuestas → nada que ocultar', () => {
    const a = agg(0);
    expect(protegerAnonimato(a, true, vacio)).toBe(a);
  });
  it('con filtro y menos del mínimo → se oculta el contenido y se marca', () => {
    const r: any = protegerAnonimato(agg(MIN_RESPUESTAS_ANONIMAS - 1), true, vacio);
    expect(r.ocultoPorAnonimato).toBe(true);
    expect(r.totalRespuestas).toBe(MIN_RESPUESTAS_ANONIMAS - 1);
    expect(r.dimensiones).toEqual(vacio.dimensiones);
  });
  it('con filtro y el mínimo exacto → se muestra', () => {
    const a = agg(MIN_RESPUESTAS_ANONIMAS);
    expect(protegerAnonimato(a, true, vacio)).toBe(a);
  });
});

describe('GET portal/programas/:id?areaId=', () => {
  function build(over: { diag?: number; fb?: number } = {}) {
    const prisma = {
      programa: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'prog1', nombre: 'P', descripcion: null, estado: 'activo', fechaInicio: null, fechaFin: null,
          totalSesionesEsperadas: null, facilitadores: [],
        }),
      },
      sesion: { findMany: vi.fn().mockResolvedValue([]) },
      participantePrograma: { count: vi.fn().mockResolvedValue(2), findMany: vi.fn().mockResolvedValue([]) },
      asistencia: { findMany: vi.fn().mockResolvedValue([]) },
      grupo: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const resultados = {
      diagnosticoAgregado: vi.fn().mockResolvedValue({
        inicial: { totalRespuestas: over.diag ?? 5, dimensiones: { escala: [{ dimension: 'x' }], seleccion: [] } },
        final: { totalRespuestas: over.diag ?? 5, dimensiones: { escala: [{ dimension: 'x' }], seleccion: [] } },
      }),
      feedbackAgregado: vi.fn().mockResolvedValue({ totalRespuestas: over.fb ?? 5, campos: [{ campoId: 'c' }] }),
    };
    return { controller: new PortalProgramasController(prisma as any, resultados as any), prisma, resultados };
  }

  it('sin areaId: no aplica ningún filtro (llamadas idénticas a las de siempre)', async () => {
    const { controller, prisma, resultados } = build();
    await controller.detalle('prog1', ACTOR);
    expect(prisma.participantePrograma.count).toHaveBeenCalledWith({ where: { programaId: 'prog1', activo: true } });
    expect(prisma.asistencia.findMany.mock.calls[0][0].where).toEqual({ sesion: { programaId: 'prog1' } });
    expect(prisma.grupo.findMany.mock.calls[0][0].where).toEqual({ programaId: 'prog1' });
    expect(resultados.diagnosticoAgregado).toHaveBeenCalledWith('prog1');
    expect(resultados.feedbackAgregado).toHaveBeenCalledWith('prog1');
  });

  it('con areaId: filtra participantes, asistencia, grupos, diagnóstico y feedback por esa área', async () => {
    const { controller, prisma, resultados } = build();
    await controller.detalle('prog1', ACTOR, 'a1');
    const f = { areaId: 'a1' };
    expect(prisma.participantePrograma.count).toHaveBeenCalledWith({
      where: { programaId: 'prog1', activo: true, usuario: f },
    });
    expect(prisma.asistencia.findMany.mock.calls[0][0].where).toEqual({ sesion: { programaId: 'prog1' }, usuario: f });
    const g = prisma.grupo.findMany.mock.calls[0][0];
    expect(g.where).toEqual({ programaId: 'prog1', miembros: { some: { usuario: f } } });
    expect(g.select._count).toEqual({ select: { miembros: { where: { usuario: f } } } });
    expect(resultados.diagnosticoAgregado).toHaveBeenCalledWith('prog1', f);
    expect(resultados.feedbackAgregado).toHaveBeenCalledWith('prog1', f);
  });

  it('areaId=sin_area filtra por usuarios sin área', async () => {
    const { controller, resultados } = build();
    await controller.detalle('prog1', ACTOR, SIN_AREA);
    expect(resultados.feedbackAgregado).toHaveBeenCalledWith('prog1', { areaId: null });
  });

  it('con filtro y pocas respuestas: oculta diagnóstico y feedback (anonimato) pero mantiene los conteos', async () => {
    const { controller } = build({ diag: 2, fb: 1 });
    const r: any = await controller.detalle('prog1', ACTOR, 'a1');
    expect(r.diagnostico.inicial.ocultoPorAnonimato).toBe(true);
    expect(r.diagnostico.inicial.dimensiones).toEqual(VACIO);
    expect(r.feedback.ocultoPorAnonimato).toBe(true);
    expect(r.feedback.campos).toEqual([]);
    expect(r.feedback.totalRespuestas).toBe(1);
    expect(r.minimoAnonimato).toBe(MIN_RESPUESTAS_ANONIMAS);
  });

  it('con filtro y suficientes respuestas: se muestran', async () => {
    const { controller } = build({ diag: 4, fb: 4 });
    const r: any = await controller.detalle('prog1', ACTOR, 'a1');
    expect(r.feedback.ocultoPorAnonimato).toBeUndefined();
    expect(r.feedback.campos).toHaveLength(1);
  });

  it('sin filtro nunca oculta, aunque haya pocas respuestas', async () => {
    const { controller } = build({ fb: 1 });
    const r: any = await controller.detalle('prog1', ACTOR);
    expect(r.feedback.ocultoPorAnonimato).toBeUndefined();
    expect(r.feedback.campos).toHaveLength(1);
  });

  it('un programa ajeno sigue dando PORTAL_ACCESO_DENEGADO aunque se pase areaId', async () => {
    const { controller, prisma } = build();
    prisma.programa.findFirst.mockResolvedValue(null);
    await expect(controller.detalle('ajeno', ACTOR, 'a1')).rejects.toMatchObject({ code: 'PORTAL_ACCESO_DENEGADO' });
  });
});

describe('Matriz de asistencia (listado de estudiantes) filtrada por área', () => {
  function buildSvc() {
    const prisma = {
      sesion: { findMany: vi.fn().mockResolvedValue([{ id: 's1', numeroSesion: 1, titulo: 'S1', fechaProgramada: new Date() }]) },
      participantePrograma: {
        findMany: vi.fn().mockResolvedValue([
          { usuarioId: 'u1', usuario: { id: 'u1', nombre: 'Ana', email: 'a@x.com', areaCatalogo: { id: 'a1', nombre: 'Diseño' } } },
          { usuarioId: 'u2', usuario: { id: 'u2', nombre: 'Beto', email: 'b@x.com', areaCatalogo: null } },
        ]),
      },
      asistencia: { findMany: vi.fn().mockResolvedValue([]) },
    };
    return { svc: new AsistenciaResumenService(prisma as any), prisma };
  }

  it('sin filtro: where de siempre', async () => {
    const { svc, prisma } = buildSvc();
    await svc.build('p1');
    expect(prisma.participantePrograma.findMany.mock.calls[0][0].where).toEqual({ programaId: 'p1', activo: true });
  });

  it('con filtro: solo participantes de esa área', async () => {
    const { svc, prisma } = buildSvc();
    await svc.build('p1', { areaId: 'a1' });
    expect(prisma.participantePrograma.findMany.mock.calls[0][0].where).toEqual({
      programaId: 'p1', activo: true, usuario: { areaId: 'a1' },
    });
  });

  it('cada fila trae el nombre del área (null si no tiene)', async () => {
    const { svc } = buildSvc();
    const { filas } = await svc.build('p1');
    expect(filas.map(f => f.area)).toEqual(['Diseño', null]);
  });

  it('el controller traduce ?areaId= en el filtro; sin él llama build(programaId) como antes', async () => {
    const prisma = { programa: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) } };
    const resumen = { build: vi.fn().mockResolvedValue({ sesiones: [], filas: [] }) };
    const c = new AdminAsistenciaController(prisma as any, resumen as any);
    await c.resumen('p1', ACTOR);
    expect(resumen.build).toHaveBeenLastCalledWith('p1');
    await c.resumen('p1', ACTOR, 'a1');
    expect(resumen.build).toHaveBeenLastCalledWith('p1', { areaId: 'a1' });
    await c.resumen('p1', ACTOR, SIN_AREA);
    expect(resumen.build).toHaveBeenLastCalledWith('p1', { areaId: null });
  });
});

describe('ResultadosService con filtro de usuario', () => {
  function buildSvc() {
    const prisma = {
      respuestaFormulario: { findMany: vi.fn().mockResolvedValue([]) },
      campoFormulario: { findMany: vi.fn().mockResolvedValue([]) },
    };
    return { svc: new ResultadosService(prisma as any), prisma };
  }
  const f = { areaId: 'a1' };

  it('sin filtro: el where no cambia', async () => {
    const { svc, prisma } = buildSvc();
    await svc.feedbackAgregado('p1');
    expect(prisma.respuestaFormulario.findMany.mock.calls[0][0].where).toEqual({
      programaId: 'p1', estado: 'submitted', plantilla: { tipoFormulario: 'feedback' },
    });
  });

  it('feedback con filtro: acota por el área del respondiente', async () => {
    const { svc, prisma } = buildSvc();
    await svc.feedbackAgregado('p1', f);
    expect(prisma.respuestaFormulario.findMany.mock.calls[0][0].where.usuarioRespondiente).toEqual(f);
  });

  it('diagnóstico final con filtro: acota por el área del respondiente', async () => {
    const { svc, prisma } = buildSvc();
    await svc.diagnosticoAgregado('p1', f);
    const wheres = prisma.respuestaFormulario.findMany.mock.calls.map(c => c[0].where);
    const final = wheres.find((w: any) => w.plantilla.tipoFormulario === 'diagnostico_final');
    expect(final.usuarioRespondiente).toEqual(f);
  });

  it('diagnóstico inicial con filtro: conserva la matrícula activa Y añade el área', async () => {
    const { svc, prisma } = buildSvc();
    await svc.diagnosticoAgregado('p1', f);
    const wheres = prisma.respuestaFormulario.findMany.mock.calls.map(c => c[0].where);
    const inicial = wheres.find((w: any) => w.plantilla.tipoFormulario === 'diagnostico_inicial');
    expect(inicial.usuarioRespondiente).toEqual({
      participaciones: { some: { programaId: 'p1', activo: true } },
      areaId: 'a1',
    });
  });
});
