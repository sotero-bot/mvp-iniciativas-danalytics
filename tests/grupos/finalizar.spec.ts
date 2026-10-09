/**
 * HU-23 · finalizar / reabrir un grupo.
 * - facilitador: solo finalizar, con scope (assertProgramaEditable → gracia RF-03/RN-03).
 * - danalytics_admin: finalizar y reabrir.
 * - roles de clase de ambos controllers y de GrupoRecursosController intactos (403 al resto).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';
import { AppError } from '../../apps/api/src/shared/errors/AppError';
import { MiembrosGrupoService } from '../../apps/api/src/modules/grupos/application/miembros.service';
import { GrupoCierreService } from '../../apps/api/src/modules/grupos/application/grupo-cierre.service';
import { FacilitadorGruposController } from '../../apps/api/src/modules/grupos/interfaces/facilitador-grupos.controller';
import { AdminGruposController } from '../../apps/api/src/modules/grupos/interfaces/admin-grupos.controller';

const FACI = { sub: 'f1', role: 'facilitador', empresaId: null } as any;
const ADMIN = { sub: 'a1', role: 'danalytics_admin', empresaId: null } as any;

const COMPLETO = {
  presentacionFinal: { entregadoEn: new Date('2026-09-01') },
  respuestasFormulario: [{ plantilla: { tipoFormulario: 'bitacora' } }, { plantilla: { tipoFormulario: 'plantilla_proyecto' } }],
};
const GRUPO_LISTO = { id: 'g1', programaId: 'p1', finalizadoEn: null, ...COMPLETO };

function build(grupo: any = GRUPO_LISTO) {
  const prisma: any = {
    grupo: {
      findUnique: vi.fn().mockResolvedValue(grupo),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
    },
  };
  const scope: any = {
    assertProgramaEditable: vi.fn().mockResolvedValue(undefined),
    assertProgramaAccessible: vi.fn().mockResolvedValue(undefined),
  };
  const cierre = new GrupoCierreService(prisma);
  const miembros = new MiembrosGrupoService(prisma);
  return {
    prisma,
    scope,
    faci: new FacilitadorGruposController(prisma, scope, miembros, cierre),
    admin: new AdminGruposController(prisma, miembros, cierre),
  };
}

describe('HU-23 · roles', () => {
  it('facilitador finaliza pero NO reabre; admin finaliza y reabre', () => {
    const f: any = FacilitadorGruposController.prototype;
    const a: any = AdminGruposController.prototype;
    expect(f.finalizarGrupo).toBeTypeOf('function');
    expect(f.reabrirGrupo).toBeUndefined();
    expect(a.finalizarGrupo).toBeTypeOf('function');
    expect(a.reabrirGrupo).toBeTypeOf('function');
  });

  it('los roles de clase no cambian (estudiante/cliente → 403 por RolesGuard)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorGruposController)).toEqual(['facilitador']);
    expect(Reflect.getMetadata(ROLES_KEY, AdminGruposController)).toEqual(['danalytics_admin']);
  });
});

describe('HU-23 · finalizar (facilitador)', () => {
  it('GRUPO_NOT_FOUND antes de cualquier scope', async () => {
    const { faci, scope } = build(null);
    await expect(faci.finalizarGrupo('g1', FACI)).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
    expect(scope.assertProgramaEditable).not.toHaveBeenCalled();
  });

  it('aplica assertProgramaEditable sobre el programa del grupo', async () => {
    const { faci, scope } = build();
    await faci.finalizarGrupo('g1', FACI);
    expect(scope.assertProgramaEditable).toHaveBeenCalledWith(expect.anything(), FACI, 'p1');
  });

  it('facilitador de otro programa → propaga FORBIDDEN y no escribe', async () => {
    const { faci, scope, prisma } = build();
    scope.assertProgramaEditable.mockRejectedValue(new AppError('FORBIDDEN'));
    await expect(faci.finalizarGrupo('g1', FACI)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.grupo.update).not.toHaveBeenCalled();
  });

  it('gracia vencida → PROGRAMA_GRACIA_VENCIDA y no escribe', async () => {
    const { faci, scope, prisma } = build();
    scope.assertProgramaEditable.mockRejectedValue(new AppError('PROGRAMA_GRACIA_VENCIDA'));
    await expect(faci.finalizarGrupo('g1', FACI)).rejects.toMatchObject({ code: 'PROGRAMA_GRACIA_VENCIDA' });
    expect(prisma.grupo.update).not.toHaveBeenCalled();
  });

  it('guarda finalizadoEn y quién lo finalizó', async () => {
    const { faci, prisma } = build();
    await faci.finalizarGrupo('g1', FACI);
    expect(prisma.grupo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'g1' },
        data: { finalizadoEn: expect.any(Date), finalizadoPorId: 'f1' },
      }),
    );
  });

  it('ya finalizado → GRUPO_FINALIZADO (no re-finaliza ni pisa al revisor original)', async () => {
    const { faci, prisma } = build({ ...GRUPO_LISTO, finalizadoEn: new Date() });
    await expect(faci.finalizarGrupo('g1', FACI)).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
    expect(prisma.grupo.update).not.toHaveBeenCalled();
  });

  it('ya finalizado Y con entrega incompleta → GRUPO_FINALIZADO (se evalúa primero)', async () => {
    const { faci } = build({ ...GRUPO_LISTO, finalizadoEn: new Date(), presentacionFinal: null });
    await expect(faci.finalizarGrupo('g1', FACI)).rejects.toMatchObject({ code: 'GRUPO_FINALIZADO' });
  });

  it('el scope se aplica ANTES de evaluar la entrega (un ajeno no averigua el estado)', async () => {
    const { faci, scope } = build({ ...GRUPO_LISTO, presentacionFinal: null });
    scope.assertProgramaEditable.mockRejectedValue(new AppError('FORBIDDEN'));
    await expect(faci.finalizarGrupo('g1', FACI)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  describe.each([
    ['sin presentación entregada', { presentacionFinal: null }],
    ['sin bitácora', { respuestasFormulario: [{ plantilla: { tipoFormulario: 'plantilla_proyecto' } }] }],
    ['sin plantilla del proyecto', { respuestasFormulario: [{ plantilla: { tipoFormulario: 'bitacora' } }] }],
  ])('la fase 3 no está entregada completa (%s)', (_n, parcial) => {
    it('→ GRUPO_ENTREGA_INCOMPLETA y no finaliza', async () => {
      const { faci, prisma } = build({ ...GRUPO_LISTO, ...parcial });
      await expect(faci.finalizarGrupo('g1', FACI)).rejects.toMatchObject({ code: 'GRUPO_ENTREGA_INCOMPLETA' });
      expect(prisma.grupo.update).not.toHaveBeenCalled();
    });
  });
});

describe('HU-23 · admin', () => {
  it('el admin tampoco puede finalizar si la entrega está incompleta', async () => {
    const { admin, prisma } = build({ ...GRUPO_LISTO, presentacionFinal: null });
    await expect(admin.finalizarGrupo('g1', ADMIN)).rejects.toMatchObject({ code: 'GRUPO_ENTREGA_INCOMPLETA' });
    expect(prisma.grupo.update).not.toHaveBeenCalled();
  });

  it('reabrir NO exige entrega completa (corrección de un cierre erróneo)', async () => {
    const { admin } = build({ id: 'g1', programaId: 'p1', finalizadoEn: new Date() });
    await expect(admin.reabrirGrupo('g1')).resolves.toBeDefined();
  });

  it('finalizar guarda el actor', async () => {
    const { admin, prisma } = build();
    await admin.finalizarGrupo('g1', ADMIN);
    expect(prisma.grupo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { finalizadoEn: expect.any(Date), finalizadoPorId: 'a1' } }),
    );
  });

  it('reabrir limpia ambos campos', async () => {
    const { admin, prisma } = build({ ...GRUPO_LISTO, finalizadoEn: new Date() });
    await admin.reabrirGrupo('g1');
    expect(prisma.grupo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'g1' }, data: { finalizadoEn: null, finalizadoPorId: null } }),
    );
  });

  it('reabrir un grupo abierto → GRUPO_NO_FINALIZADO', async () => {
    const { admin, prisma } = build();
    await expect(admin.reabrirGrupo('g1')).rejects.toMatchObject({ code: 'GRUPO_NO_FINALIZADO' });
    expect(prisma.grupo.update).not.toHaveBeenCalled();
  });

  it('reabrir un grupo inexistente → GRUPO_NOT_FOUND', async () => {
    const { admin } = build(null);
    await expect(admin.reabrirGrupo('g1')).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
  });
});

describe('HU-23 · listado de grupos del facilitador para revisar', () => {
  it('el select trae si el grupo entregó la presentación y su finalización', async () => {
    const { faci, prisma } = build();
    prisma.grupo.findMany = vi.fn().mockResolvedValue([]);
    await faci.listGrupos('p1', FACI);
    const sel = prisma.grupo.findMany.mock.calls[0][0].select;
    expect(sel.presentacionFinal).toEqual({ select: { entregadoEn: true } });
    expect(sel.finalizadoEn).toBe(true);
    expect(sel.respuestasFormulario).toBeDefined();
  });

  it('cada grupo trae entregaCompleta calculado en el servidor (sin exponer las respuestas)', async () => {
    const { faci, prisma } = build();
    prisma.grupo.findMany = vi.fn().mockResolvedValue([
      { id: 'a', ...COMPLETO, finalizadoEn: null, miembros: [] },
      { id: 'b', presentacionFinal: null, respuestasFormulario: [], finalizadoEn: null, miembros: [] },
    ]);
    const r: any[] = await faci.listGrupos('p1', FACI);
    expect(r.map((g) => g.entregaCompleta)).toEqual([true, false]);
    // detalle de qué falta, para pintar la barra de progreso sin entrar al grupo
    expect(r[0].faltante).toEqual({ presentacion: false, bitacora: false, plantillaProyecto: false });
    expect(r[1].faltante).toEqual({ presentacion: true, bitacora: true, plantillaProyecto: true });
    expect(r[0].respuestasFormulario).toBeUndefined();
  });
});
