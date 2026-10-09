/**
 * HU-17: métricas de empresas (activas / inactivas / total) para el panel admin.
 * El endpoint es global y exclusivo de `danalytics_admin` (hereda @Roles de clase).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY, RolesGuard } from '../../apps/api/src/modules/auth/guards';
import { AppError } from '../../apps/api/src/shared/errors/AppError';
import { EmpresasController } from '../../apps/api/src/modules/organization/interfaces/empresas.controller';

function build(grupos: Array<{ activo: boolean; _count: { _all: number } }>) {
  const prisma = {
    empresa: {
      groupBy: vi.fn().mockResolvedValue(grupos),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return { controller: new EmpresasController(prisma as any), prisma };
}

describe('GET organization/empresas/metricas', () => {
  it('cuenta 3 activas y 2 inactivas con groupBy', async () => {
    const { controller, prisma } = build([
      { activo: true, _count: { _all: 3 } },
      { activo: false, _count: { _all: 2 } },
    ]);
    await expect(controller.metricas()).resolves.toEqual({ total: 5, activas: 3, inactivas: 2 });
    expect(prisma.empresa.groupBy).toHaveBeenCalledWith({ by: ['activo'], _count: { _all: true } });
  });

  it('solo activas → inactivas 0 y total === activas', async () => {
    const { controller } = build([{ activo: true, _count: { _all: 4 } }]);
    await expect(controller.metricas()).resolves.toEqual({ total: 4, activas: 4, inactivas: 0 });
  });

  it('sin empresas → todo en 0', async () => {
    const { controller } = build([]);
    await expect(controller.metricas()).resolves.toEqual({ total: 0, activas: 0, inactivas: 0 });
  });

  it('declara @Roles(danalytics_admin) (a nivel de clase)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, EmpresasController)).toContain('danalytics_admin');
  });

  it('facilitador recibe 403 (FORBIDDEN) en el handler de métricas', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => EmpresasController.prototype.metricas,
      getClass: () => EmpresasController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'facilitador' } }) }),
    } as unknown as ExecutionContext;
    try {
      guard.canActivate(ctx);
      throw new Error('debió lanzar FORBIDDEN');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(403);
    }
  });
});

describe('GET organization/empresas (listado)', () => {
  it('por defecto filtra solo activas', async () => {
    const { controller, prisma } = build([]);
    await controller.findAll();
    expect(prisma.empresa.findMany.mock.calls[0][0].where).toEqual({ activo: true });
  });

  it('incluirInactivas=1 quita el where', async () => {
    const { controller, prisma } = build([]);
    await controller.findAll('1');
    expect(prisma.empresa.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('otro valor de incluirInactivas mantiene el filtro de activas', async () => {
    const { controller, prisma } = build([]);
    await controller.findAll('0');
    expect(prisma.empresa.findMany.mock.calls[0][0].where).toEqual({ activo: true });
  });
});
