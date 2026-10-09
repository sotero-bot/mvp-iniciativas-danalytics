/**
 * HU-23 · grupo finalizado por el revisor: bitácora, plantilla y presentación quedan
 * inmodificables (GRUPO_FINALIZADO), incluida la RE-ENTREGA de la presentación, que hoy
 * (upsert) no está protegida. La UI recibe `bloqueada` y `finalizado`.
 */

import { describe, it, expect, vi } from 'vitest';

import { GrupoRecursosController } from '../../apps/api/src/modules/reto/interfaces/grupo-recursos.controller';

const ACTOR = { sub: 'est1', role: 'estudiante', empresaId: null } as any;
const FINALIZADO_EN = new Date('2026-10-01T00:00:00Z');

function grupo(finalizadoEn: Date | null) {
  return {
    id: 'g1',
    programaId: 'prog1',
    nombre: 'Grupo 1',
    orden: 1,
    finalizadoEn,
    programa: {
      id: 'prog1',
      nombre: 'Programa IA',
      estado: 'activo',
      presentacionDesdeSesion: null,
      bitacoraHabilitadaEn: new Date('2026-07-01'),
      empresa: { nombre: 'Acme' },
      sesiones: [],
    },
  };
}

function build(finalizadoEn: Date | null, entregada = false) {
  const prisma = {
    grupo: { findUnique: vi.fn().mockResolvedValue(grupo(finalizadoEn)), findMany: vi.fn().mockResolvedValue([]) },
    miembroGrupo: { findFirst: vi.fn().mockResolvedValue({ id: 'm1' }) },
    plantillaFormulario: {
      findFirst: vi.fn().mockResolvedValue({ id: 'pl1', programaId: 'prog1', tipoFormulario: 'bitacora', nombre: 'B', descripcion: null }),
    },
    campoFormulario: { findMany: vi.fn().mockResolvedValue([]) },
    respuestaFormulario: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    presentacionFinal: {
      findUnique: vi.fn().mockResolvedValue(entregada ? { entregadoEn: new Date('2026-09-01') } : null),
      upsert: vi.fn(),
    },
  };
  const scope = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined), programaScope: vi.fn().mockReturnValue({}) };
  const s3 = {
    isConfigured: true,
    generateKey: vi.fn((p: string, f: string) => `${p}/1-${f}`),
    getPresignedPutUrl: vi.fn().mockResolvedValue('https://s3/up'),
  };
  const controller = new GrupoRecursosController(prisma as any, scope as any, { applyOverlay: vi.fn().mockResolvedValue({}) } as any, s3 as any);
  return { controller, prisma, s3 };
}

describe('HU-23 · grupo finalizado bloquea al estudiante', () => {
  it('PUT bitácora/draft → GRUPO_FINALIZADO y no escribe', async () => {
    const { controller, prisma } = build(FINALIZADO_EN);
    await expect(controller.saveBitacoraDraft('g1', { datos: {} }, ACTOR)).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    expect(prisma.respuestaFormulario.create).not.toHaveBeenCalled();
    expect(prisma.respuestaFormulario.update).not.toHaveBeenCalled();
  });

  it('PUT plantilla-proyecto/draft → GRUPO_FINALIZADO', async () => {
    const { controller } = build(FINALIZADO_EN);
    await expect(controller.savePlantillaProyectoDraft('g1', { datos: {} }, ACTOR)).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
  });

  it('presign de la presentación → GRUPO_FINALIZADO (no firma)', async () => {
    const { controller, s3 } = build(FINALIZADO_EN);
    await expect(
      controller.presignPresentacion('g1', { filename: 'demo.pdf', contentType: 'application/pdf' }, ACTOR),
    ).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    expect(s3.getPresignedPutUrl).not.toHaveBeenCalled();
  });

  it('RE-ENTREGA de la presentación tras finalizar → GRUPO_FINALIZADO (hueco del upsert)', async () => {
    const { controller, prisma } = build(FINALIZADO_EN, true);
    await expect(controller.entregarPresentacion('g1', { archivoKey: 'a/b/demo.pdf' } as any, ACTOR)).rejects.toMatchObject({
      code: 'GRUPO_FINALIZADO',
    });
    expect(prisma.presentacionFinal.upsert).not.toHaveBeenCalled();
  });

  it('getBitacora de un grupo finalizado sin entrega → bloqueada y finalizado', async () => {
    const { controller } = build(FINALIZADO_EN, false);
    const r: any = await controller.getBitacora('g1', ACTOR);
    expect(r.bloqueada).toBe(true);
    expect(r.finalizado).toBe(true);
  });

  it('getBitacora con entrega pero SIN finalizar → bloqueada, finalizado=false (regresión)', async () => {
    const { controller } = build(null, true);
    const r: any = await controller.getBitacora('g1', ACTOR);
    expect(r.bloqueada).toBe(true);
    expect(r.finalizado).toBe(false);
  });

  it('grupo abierto sigue guardando (regresión)', async () => {
    const { controller, prisma } = build(null);
    prisma.respuestaFormulario.create.mockResolvedValue({ id: 'r1' });
    await controller.saveBitacoraDraft('g1', { datos: {} }, ACTOR);
    expect(prisma.respuestaFormulario.create).toHaveBeenCalled();
  });

  it('GET grupos/mios expone finalizado y marca los recursos como entregados', async () => {
    const { controller, prisma } = build(FINALIZADO_EN);
    prisma.grupo.findMany.mockResolvedValue([
      { ...grupo(FINALIZADO_EN), miembros: [], respuestasFormulario: [], presentacionFinal: null },
    ]);
    const [g]: any[] = await controller.misGrupos(ACTOR);
    expect(g.finalizado).toBe(true);
    expect(g.finalizadoEn).toEqual(FINALIZADO_EN);
    expect(g.recursos.bitacora.entregada).toBe(true);
    expect(g.recursos.plantillaProyecto.entregada).toBe(true);
  });
});
