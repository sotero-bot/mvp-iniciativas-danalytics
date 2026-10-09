/**
 * HU-14: catálogo de áreas por empresa (admin). Soft delete, unicidad por empresa y
 * no filtrar la existencia de áreas de otra empresa (AREA_NOT_FOUND, no FORBIDDEN).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY, RolesGuard } from '../../apps/api/src/modules/auth/guards';
import { AppError } from '../../apps/api/src/shared/errors/AppError';
import { AdminAreasController } from '../../apps/api/src/modules/organization/interfaces/admin-areas.controller';

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

function build(overrides: Record<string, any> = {}) {
  const prisma = {
    areaEmpresa: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: 'a1', empresaId: 'emp1', nombre: 'Diseño', activo: true }),
      create: vi.fn().mockResolvedValue({ id: 'a1', empresaId: 'emp1', nombre: 'Diseño' }),
      update: vi.fn().mockResolvedValue({ id: 'a1' }),
      delete: vi.fn(),
      ...overrides,
    },
  };
  return { controller: new AdminAreasController(prisma as any), prisma };
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return (e as AppError).code;
  }
  throw new Error('debió lanzar AppError');
}

describe('POST organization/empresas/:empresaId/areas', () => {
  it('nombre duplicado (P2002) → AREA_DUPLICATE', async () => {
    const { controller } = build({ create: vi.fn().mockRejectedValue(p2002()) });
    expect(await codeOf(controller.create('emp1', { nombre: 'Diseño' }))).toBe('AREA_DUPLICATE');
  });

  it('crea el área ligada a la empresa de la ruta', async () => {
    const { controller, prisma } = build();
    await controller.create('emp1', { nombre: '  Diseño  ' });
    expect(prisma.areaEmpresa.create.mock.calls[0][0].data).toMatchObject({ empresaId: 'emp1', nombre: 'Diseño' });
  });
});

describe('PATCH organization/empresas/:empresaId/areas/:id', () => {
  it('área de OTRA empresa → AREA_NOT_FOUND (no FORBIDDEN) y no actualiza', async () => {
    const { controller, prisma } = build({
      findUnique: vi.fn().mockResolvedValue({ id: 'a1', empresaId: 'otra', nombre: 'X' }),
    });
    expect(await codeOf(controller.update('emp1', 'a1', { nombre: 'Y' }))).toBe('AREA_NOT_FOUND');
    expect(prisma.areaEmpresa.update).not.toHaveBeenCalled();
  });

  it('área inexistente → AREA_NOT_FOUND', async () => {
    const { controller } = build({ findUnique: vi.fn().mockResolvedValue(null) });
    expect(await codeOf(controller.update('emp1', 'a1', { nombre: 'Y' }))).toBe('AREA_NOT_FOUND');
  });

  it('renombrar a un nombre existente (P2002) → AREA_DUPLICATE', async () => {
    const { controller } = build({ update: vi.fn().mockRejectedValue(p2002()) });
    expect(await codeOf(controller.update('emp1', 'a1', { nombre: 'Operaciones' }))).toBe('AREA_DUPLICATE');
  });
});

describe('DELETE organization/empresas/:empresaId/areas/:id (soft delete)', () => {
  it('llama a update({ activo: false }) y NUNCA a delete', async () => {
    const { controller, prisma } = build();
    await controller.remove('emp1', 'a1');
    expect(prisma.areaEmpresa.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: { activo: false } }),
    );
    expect(prisma.areaEmpresa.delete).not.toHaveBeenCalled();
  });

  it('área de otra empresa → AREA_NOT_FOUND y no desactiva', async () => {
    const { controller, prisma } = build({
      findUnique: vi.fn().mockResolvedValue({ id: 'a1', empresaId: 'otra', nombre: 'X' }),
    });
    expect(await codeOf(controller.remove('emp1', 'a1'))).toBe('AREA_NOT_FOUND');
    expect(prisma.areaEmpresa.update).not.toHaveBeenCalled();
  });
});

describe('GET organization/empresas/:empresaId/areas', () => {
  it('por defecto: solo activas de la empresa, con _count de usuarios', async () => {
    const { controller, prisma } = build();
    await controller.list('emp1');
    const arg = prisma.areaEmpresa.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ empresaId: 'emp1', activo: true });
    expect(arg.select._count).toEqual({ select: { usuarios: true } });
  });

  it('incluirInactivas=1 → todas', async () => {
    const { controller, prisma } = build();
    await controller.list('emp1', '1');
    expect(prisma.areaEmpresa.findMany.mock.calls[0][0].where).toEqual({ empresaId: 'emp1' });
  });
});

describe('Autorización', () => {
  it('declara @Roles(danalytics_admin) a nivel de clase', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminAreasController)).toEqual(['danalytics_admin']);
  });

  it('facilitador recibe 403', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => AdminAreasController.prototype.create,
      getClass: () => AdminAreasController,
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
