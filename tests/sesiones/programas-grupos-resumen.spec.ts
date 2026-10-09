/**
 * HU-23 (revisión por programa): GET /programas trae, para facilitador/admin, cuántos grupos
 * hay, cuántos están LISTOS PARA REVISAR (entregaron la presentación final y aún no fueron
 * finalizados) y cuántos ya están finalizados. El estudiante no recibe ese conteo.
 */

import { describe, it, expect, vi } from 'vitest';

import { ActorSesionesController } from '../../apps/api/src/modules/sesiones/interfaces/actor-sesiones.controller';

const FACILITADOR = { sub: 'f1', userId: 'f1', role: 'facilitador' as const, empresaId: null };
const ESTUDIANTE = { sub: 'e1', userId: 'e1', role: 'estudiante' as const, empresaId: null };

const programa = (grupos: unknown[]) => ({
  id: 'p1',
  nombre: 'P1',
  estado: 'activo',
  bitacoraHabilitadaEn: null,
  presentacionDesdeSesion: null,
  sesiones: [],
  grupos,
});

function build(grupos: unknown[]) {
  const prisma = { programa: { findMany: vi.fn().mockResolvedValue([programa(grupos)]) } };
  const scope = { programaScope: vi.fn().mockReturnValue({}), graciaVencida: vi.fn().mockReturnValue(false) };
  return { controller: new ActorSesionesController(prisma as any, scope as any, {} as any), prisma };
}

const COMPLETO = {
  presentacionFinal: { entregadoEn: new Date() },
  respuestasFormulario: [{ plantilla: { tipoFormulario: 'bitacora' } }, { plantilla: { tipoFormulario: 'plantilla_proyecto' } }],
};

const GRUPOS = [
  { finalizadoEn: null, presentacionFinal: null, respuestasFormulario: [] }, // en curso
  { finalizadoEn: null, ...COMPLETO }, // listo para revisar
  { finalizadoEn: null, ...COMPLETO }, // listo para revisar
  { finalizadoEn: new Date(), ...COMPLETO }, // finalizado (no cuenta como "listo")
  { finalizadoEn: new Date(), presentacionFinal: null, respuestasFormulario: [] }, // finalizado (cerrado antes de la regla)
  { finalizadoEn: null, presentacionFinal: { entregadoEn: new Date() }, respuestasFormulario: [] }, // entregó la presentación pero falta bitácora/plantilla → NO listo
];

describe('GET /programas — conteo de grupos para revisión', () => {
  it('facilitador: total, listos para revisar y finalizados', async () => {
    const { controller } = build(GRUPOS);
    const [p]: any[] = await controller.listMisProgramas(FACILITADOR);
    expect(p.gruposResumen).toEqual({ total: 6, listos: 2, finalizados: 2 });
  });

  it('no filtra la lista cruda de grupos en la respuesta', async () => {
    const { controller } = build(GRUPOS);
    const [p]: any[] = await controller.listMisProgramas(FACILITADOR);
    expect(p.grupos).toBeUndefined();
  });

  it('programa sin grupos → todo en cero', async () => {
    const { controller } = build([]);
    const [p]: any[] = await controller.listMisProgramas(FACILITADOR);
    expect(p.gruposResumen).toEqual({ total: 0, listos: 0, finalizados: 0 });
  });

  it('el estudiante NO recibe el conteo de grupos del programa', async () => {
    const { controller } = build(GRUPOS);
    const [p]: any[] = await controller.listMisProgramas(ESTUDIANTE);
    expect(p.gruposResumen).toBeUndefined();
    expect(p.grupos).toBeUndefined();
  });

  it('el select pide solo lo necesario de los grupos', async () => {
    const { controller, prisma } = build(GRUPOS);
    await controller.listMisProgramas(FACILITADOR);
    const sel = prisma.programa.findMany.mock.calls[0][0].select.grupos.select;
    expect(sel.finalizadoEn).toBe(true);
    expect(sel.presentacionFinal).toEqual({ select: { entregadoEn: true } });
    expect(sel.respuestasFormulario).toBeDefined();
  });
});
