/**
 * `ActorScopeService` (Plan 2 §0.1, RNF-02/RN-09) — fragmentos WHERE por rol y
 * `assertProgramaAccessible`, incluyendo la extensión RF-03/RN-03: un facilitador
 * pierde acceso a un programa `finalizado` una vez vencidos los días de gracia.
 */

import { describe, it, expect, vi } from 'vitest';

import { ActorScopeService } from '../../apps/api/src/modules/auth/scoping/actor-scope.service';
import { AppError } from '../../apps/api/src/shared/errors/AppError';
import type { AuthUser } from '../../apps/api/src/modules/auth/guards/auth-user';

function actor(overrides: Partial<AuthUser>): AuthUser {
  return { sub: 'u1', userId: 'u1', role: 'facilitador', empresaId: null, ...overrides };
}

describe('ActorScopeService.programaScope', () => {
  const svc = new ActorScopeService();

  it('danalytics_admin: sin filtro', () => {
    expect(svc.programaScope(actor({ role: 'danalytics_admin' }))).toEqual({});
  });

  it('facilitador: filtra por facilitadorId = sub', () => {
    expect(svc.programaScope(actor({ role: 'facilitador', sub: 'f1' }))).toEqual({
      facilitadorId: 'f1',
    });
  });

  it('estudiante: filtra por participante activo', () => {
    expect(svc.programaScope(actor({ role: 'estudiante', sub: 's1' }))).toEqual({
      participantes: { some: { usuarioId: 's1', activo: true } },
    });
  });

  it('cliente_admin: filtra por empresaId', () => {
    expect(
      svc.programaScope(actor({ role: 'cliente_admin', empresaId: 'e1' })),
    ).toEqual({ empresaId: 'e1' });
  });

  it('cliente_admin sin empresaId → FORBIDDEN', () => {
    expect(() => svc.programaScope(actor({ role: 'cliente_admin', empresaId: null }))).toThrowError(
      AppError,
    );
  });

  it('rol desconocido → FORBIDDEN', () => {
    expect(() =>
      svc.programaScope(actor({ role: null })),
    ).toThrowError(AppError);
  });
});

describe('ActorScopeService.assertProgramaAccessible', () => {
  const svc = new ActorScopeService();

  it('403 si el programa no aparece en el scope del actor', async () => {
    const prisma = { programa: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(
      svc.assertProgramaAccessible(prisma, actor({ role: 'facilitador' }), 'p1'),
    ).rejects.toThrowError(AppError);
  });

  it('pasa si el programa está activo dentro del scope', async () => {
    const prisma = {
      programa: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'p1', estado: 'activo', fechaFin: null, diasGracia: 3 }),
      },
    };
    await expect(
      svc.assertProgramaAccessible(prisma, actor({ role: 'facilitador' }), 'p1'),
    ).resolves.toBeUndefined();
  });

  it('RF-03: 403 para facilitador si el programa finalizó y ya venció la gracia', async () => {
    const fechaFin = new Date();
    fechaFin.setUTCDate(fechaFin.getUTCDate() - 30); // hace 30 días, sobra cualquier gracia
    const prisma = {
      programa: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'p1', estado: 'finalizado', fechaFin, diasGracia: 3 }),
      },
    };
    await expect(
      svc.assertProgramaAccessible(prisma, actor({ role: 'facilitador' }), 'p1'),
    ).rejects.toThrowError(AppError);
  });

  it('RF-03: pasa para facilitador si el programa finalizó pero la gracia sigue vigente', async () => {
    const fechaFin = new Date(); // hoy: la gracia de 3 días hábiles no ha vencido
    const prisma = {
      programa: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'p1', estado: 'finalizado', fechaFin, diasGracia: 3 }),
      },
    };
    await expect(
      svc.assertProgramaAccessible(prisma, actor({ role: 'facilitador' }), 'p1'),
    ).resolves.toBeUndefined();
  });

  it('RF-03 no aplica a admin: pasa aunque el programa esté finalizado hace mucho', async () => {
    const fechaFin = new Date();
    fechaFin.setUTCDate(fechaFin.getUTCDate() - 30);
    const prisma = {
      programa: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'p1', estado: 'finalizado', fechaFin, diasGracia: 3 }),
      },
    };
    await expect(
      svc.assertProgramaAccessible(prisma, actor({ role: 'danalytics_admin' }), 'p1'),
    ).resolves.toBeUndefined();
  });
});
