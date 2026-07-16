/**
 * C-02 (aclaración 2026-07-14): el facilitador puede crear grupos y asignar
 * integrantes en SUS programas, pero NO quitar integrantes, renombrar ni eliminar
 * (no existen esos handlers). Registrar/matricular sigue siendo solo del admin.
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

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
    participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp1' }), findMany: vi.fn().mockResolvedValue([]) },
    miembroGrupo: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'm1' }) },
    ...overrides.prisma,
  };
  const scope: any = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined) };
  return { controller: new FacilitadorGruposController(prisma as any, scope as any), prisma, scope };
}

describe('C-02 · facilitador crea grupos y asigna integrantes', () => {
  it('solo expone GET + POST (sin DELETE/PATCH de grupo ni de integrante)', () => {
    const handlers = Object.getOwnPropertyNames(FacilitadorGruposController.prototype).filter(n => n !== 'constructor');
    expect(handlers.sort()).toEqual(['addMiembro', 'createGrupo', 'listGrupos', 'listParticipantes']);
  });

  it('crear grupo valida acceso al programa y asigna orden', async () => {
    const { controller, scope, prisma } = build();
    await controller.createGrupo('p1', { nombre: 'Equipo A' }, ACTOR);
    expect(scope.assertProgramaAccessible).toHaveBeenCalled();
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

  it('asignar a alguien ya en un grupo → MIEMBRO_YA_EN_GRUPO (RN-04)', async () => {
    const { controller } = build({
      prisma: {
        grupo: { findUnique: vi.fn().mockResolvedValue({ id: 'g1', programaId: 'p1' }) },
        participantePrograma: { findFirst: vi.fn().mockResolvedValue({ id: 'pp1' }) },
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
