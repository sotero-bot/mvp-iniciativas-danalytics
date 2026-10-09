/**
 * C-02 (2026-07-14) + HU-21/22 (2026-10): el facilitador crea grupos, asigna,
 * quita y reemplaza integrantes, y renombra grupos en SUS programas. HU-21/22
 * revierten la restricción original de C-02 (que solo permitía alta). NO puede
 * eliminar grupos ni cambiar su orden. Registrar/matricular sigue siendo solo del admin.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { ROLES_KEY } from '../../apps/api/src/modules/auth/guards';

import { ForbiddenException } from '@nestjs/common';
import { AppError } from '../../apps/api/src/shared/errors/AppError';
import { MiembrosGrupoService } from '../../apps/api/src/modules/grupos/application/miembros.service';
import { FacilitadorGruposController } from '../../apps/api/src/modules/grupos/interfaces/facilitador-grupos.controller';

const ACTOR = { sub: 'f1', role: 'facilitador', empresaId: null } as any;

function build(overrides: Record<string, any> = {}) {
  const prisma: any = {
    grupo: {
      findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }),
      findFirst: vi.fn().mockResolvedValue({ orden: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'g2', nombre: 'G' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp1', confirmadoEn: new Date('2026-01-01') }), findMany: vi.fn().mockResolvedValue([]) },
    miembroGrupo: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'm1' }) },
    ...overrides.prisma,
  };
  const scope: any = {
    assertProgramaEditable: vi.fn().mockResolvedValue(undefined),
    assertProgramaAccessible: vi.fn().mockResolvedValue(undefined),
  };
  return { controller: new FacilitadorGruposController(prisma as any, scope as any, new MiembrosGrupoService(prisma as any)), prisma, scope };
}

describe('HU-21/22 · facilitador edita grupos e integrantes', () => {
  it('metadata de roles del controller: solo facilitador', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorGruposController)).toEqual(['facilitador']);
  });

  it('expone los handlers de PATCH grupo, DELETE miembro, reemplazar, mover e intercambiar (y no DELETE de grupo)', () => {
    const proto: any = FacilitadorGruposController.prototype;
    expect(proto.updateGrupo).toBeTypeOf('function');
    expect(proto.removeMiembro).toBeTypeOf('function');
    expect(proto.reemplazarMiembro).toBeTypeOf('function');
    expect(proto.moverMiembro).toBeTypeOf('function');
    expect(proto.intercambiarMiembro).toBeTypeOf('function');
    expect(proto.deleteGrupo).toBeUndefined();
  });

  describe.each([
    ['PATCH grupo', (c: any) => c.updateGrupo('g1', { nombre: 'Nuevo' }, ACTOR)],
    ['DELETE miembro', (c: any) => c.removeMiembro('g1', 'u1', ACTOR)],
    ['POST reemplazar', (c: any) => c.reemplazarMiembro('g1', { salienteId: 'u1', entranteId: 'u2' }, ACTOR)],
  ])('%s', (_nombre, call) => {
    function buildEscritura() {
      return build({
        prisma: {
          grupo: {
            findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }),
            update: vi.fn().mockResolvedValue({ id: 'g1', nombre: 'Nuevo' }),
          },
          participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp1', confirmadoEn: new Date('2026-01-01') }) },
          miembroGrupo: {
            findFirst: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(where.grupoId ? { id: 'm1' } : null)),
            count: vi.fn().mockResolvedValue(3),
            delete: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({}),
          },
          $transaction: vi.fn().mockResolvedValue([]),
        },
      });
    }

    it('valida con assertProgramaEditable (escritura), no assertProgramaAccessible', async () => {
      const { controller, scope } = buildEscritura();
      await call(controller);
      expect(scope.assertProgramaEditable).toHaveBeenCalledWith(expect.anything(), ACTOR, 'p1');
      expect(scope.assertProgramaAccessible).not.toHaveBeenCalled();
    });

    it('programa ajeno → 403 (propaga el error del scope)', async () => {
      const { controller, scope } = buildEscritura();
      scope.assertProgramaEditable.mockRejectedValue(new ForbiddenException());
      await expect(call(controller)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('gracia vencida → PROGRAMA_GRACIA_VENCIDA', async () => {
      const { controller, scope } = buildEscritura();
      scope.assertProgramaEditable.mockRejectedValue(new AppError('PROGRAMA_GRACIA_VENCIDA'));
      await expect(call(controller)).rejects.toMatchObject({ code: 'PROGRAMA_GRACIA_VENCIDA' });
    });

    it('grupo inexistente → GRUPO_NOT_FOUND antes del chequeo de scope', async () => {
      const { controller, scope, prisma } = buildEscritura();
      prisma.grupo.findUnique.mockResolvedValue(null);
      await expect(call(controller)).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
      expect(scope.assertProgramaEditable).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['POST mover', (c: any) => c.moverMiembro('g1', { usuarioId: 'u1', destinoGrupoId: 'g2' }, ACTOR)],
    ['POST intercambiar', (c: any) => c.intercambiarMiembro('g1', { usuarioId: 'u1', conUsuarioId: 'u2' }, ACTOR)],
  ])('%s (mover / intercambiar entre grupos)', (_nombre, call) => {
    function buildMover() {
      return build({
        prisma: {
          grupo: { findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: where.id, programaId: 'p1' })) },
          miembroGrupo: {
            findFirst: vi.fn().mockImplementation(({ where }: any) =>
              Promise.resolve(where.grupoId ? { id: 'm1', grupoId: 'g1' } : { id: 'm2', grupoId: 'g2' }),
            ),
            update: vi.fn().mockResolvedValue({}),
          },
          $transaction: vi.fn().mockResolvedValue([]),
        },
      });
    }

    it('valida con assertProgramaEditable sobre el programa del grupo de origen', async () => {
      const { controller, scope } = buildMover();
      await call(controller);
      expect(scope.assertProgramaEditable).toHaveBeenCalledWith(expect.anything(), ACTOR, 'p1');
      expect(scope.assertProgramaAccessible).not.toHaveBeenCalled();
    });

    it('programa ajeno → 403', async () => {
      const { controller, scope } = buildMover();
      scope.assertProgramaEditable.mockRejectedValue(new ForbiddenException());
      await expect(call(controller)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('gracia vencida → PROGRAMA_GRACIA_VENCIDA', async () => {
      const { controller, scope } = buildMover();
      scope.assertProgramaEditable.mockRejectedValue(new AppError('PROGRAMA_GRACIA_VENCIDA'));
      await expect(call(controller)).rejects.toMatchObject({ code: 'PROGRAMA_GRACIA_VENCIDA' });
    });

    it('grupo inexistente → GRUPO_NOT_FOUND antes del chequeo de scope', async () => {
      const { controller, scope, prisma } = buildMover();
      prisma.grupo.findUnique.mockResolvedValue(null);
      await expect(call(controller)).rejects.toMatchObject({ code: 'GRUPO_NOT_FOUND' });
      expect(scope.assertProgramaEditable).not.toHaveBeenCalled();
    });
  });

  it.each([[2], [1]])('DELETE miembro en un grupo de %i queda permitido (sin mínimo) y borra la fila', async (total) => {
    const { controller, prisma } = build({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }) },
        miembroGrupo: {
          findFirst: vi.fn().mockResolvedValue({ id: 'm1' }),
          count: vi.fn().mockResolvedValue(total),
          delete: vi.fn().mockResolvedValue({}),
        },
      },
    });
    await expect(controller.removeMiembro('g1', 'u1', ACTOR)).resolves.toBeUndefined();
    expect(prisma.miembroGrupo.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });

  it('mover de un grupo a otro: quitar de G1 y luego asignar a G2 funciona aunque G1 quede con 1', async () => {
    const { controller, prisma } = build({
      prisma: {
        grupo: { findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: where.id, programaId: 'p1' })) },
        participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp1', confirmadoEn: new Date('2026-01-01') }) },
        miembroGrupo: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: 'm1' }) // quitar: es miembro de G1
            .mockResolvedValueOnce(null), // agregar: ya no está en ningún grupo
          delete: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({ id: 'm2' }),
        },
      },
    });
    await controller.removeMiembro('g1', 'u1', ACTOR);
    await controller.addMiembro('g2', { usuarioId: 'u1' }, ACTOR);
    expect(prisma.miembroGrupo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ grupoId: 'g2', programaId: 'p1', usuarioId: 'u1' }) }),
    );
  });

  it('PATCH grupo actualiza solo el nombre (ignora orden)', async () => {
    const { controller, prisma } = build({
      prisma: { grupo: { findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }), update: vi.fn().mockResolvedValue({}) } },
    });
    await controller.updateGrupo('g1', { nombre: 'Nuevo', orden: 9 } as any, ACTOR);
    expect(prisma.grupo.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'g1' }, data: { nombre: 'Nuevo' } }));
  });

  it('crear grupo valida que el programa sea editable por el actor y asigna orden', async () => {
    const { controller, scope, prisma } = build();
    await controller.createGrupo('p1', { nombre: 'Equipo A' }, ACTOR);
    expect(scope.assertProgramaEditable).toHaveBeenCalled();
    expect(prisma.grupo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ programaId: 'p1', nombre: 'Equipo A', orden: 2, creadoPorId: 'f1' }) }),
    );
  });

  it('asignar integrante NO participante → MIEMBRO_NO_PARTICIPA', async () => {
    const { controller } = build({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }) },
        participantePrograma: { findFirst: vi.fn().mockResolvedValue(null) },
        miembroGrupo: { findFirst: vi.fn(), create: vi.fn() },
      },
    });
    await expect(controller.addMiembro('g1', { usuarioId: 'x' }, ACTOR)).rejects.toMatchObject({
      code: 'MIEMBRO_NO_PARTICIPA',
    });
  });

  it('asignar participante sin confirmar → MIEMBRO_NO_CONFIRMADO', async () => {
    const { controller, prisma } = build({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }) },
        participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp1', confirmadoEn: null }) },
        miembroGrupo: { findFirst: vi.fn(), create: vi.fn() },
      },
    });
    await expect(controller.addMiembro('g1', { usuarioId: 'u2' }, ACTOR)).rejects.toMatchObject({
      code: 'MIEMBRO_NO_CONFIRMADO',
    });
    expect(prisma.miembroGrupo.create).not.toHaveBeenCalled();
  });

  it('asignar a alguien ya en un grupo → MIEMBRO_YA_EN_GRUPO (RN-04)', async () => {
    const { controller } = build({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }) },
        participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp1', confirmadoEn: new Date('2026-01-01') }) },
        miembroGrupo: { findFirst: vi.fn().mockResolvedValue({ id: 'm0' }), create: vi.fn() },
      },
    });
    await expect(controller.addMiembro('g1', { usuarioId: 'u2' }, ACTOR)).rejects.toMatchObject({
      code: 'MIEMBRO_YA_EN_GRUPO',
    });
  });

  it('asignar integrante válido crea la fila puente', async () => {
    const { controller, prisma } = build();
    await controller.addMiembro('g1', { usuarioId: 'u2' }, ACTOR);
    expect(prisma.miembroGrupo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ grupoId: 'g1', programaId: 'p1', usuarioId: 'u2' }) }),
    );
  });
});
