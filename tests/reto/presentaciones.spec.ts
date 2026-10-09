/**
 * HU-03 — `GET facilitador/programas/:id/presentaciones`: contador de retos entregados con
 * el enlace / indicador de archivo por grupo. Solo facilitador, scopeado por programa.
 * `archivoKey` nunca sale (se expone `conArchivo`).
 */

import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

import { ROLES_KEY, RolesGuard } from '../../apps/api/src/modules/auth/guards';
import { FacilitadorRetoController } from '../../apps/api/src/modules/reto/interfaces/facilitador-reto.controller';
import { AppError } from '../../apps/api/src/shared/errors/AppError';

const FACI = { sub: 'fac1', role: 'facilitador', empresaId: null } as any;
const entrega = new Date('2026-09-01T10:00:00Z');

const GRUPOS = [
  {
    id: 'g1',
    nombre: 'Grupo 1',
    orden: 1,
    _count: { miembros: 3 },
    miembros: [],
    presentacionFinal: { entregadoEn: entrega, urlPresentacion: 'https://x.co/p', archivoKey: 'k/g1.pdf' },
  },
  { id: 'g2', nombre: 'Grupo 2', orden: 2, _count: { miembros: 2 }, miembros: [], presentacionFinal: null },
];

function build(grupos: unknown[] = GRUPOS, scopeOverride: Record<string, unknown> = {}) {
  const prisma = { grupo: { findMany: vi.fn().mockResolvedValue(grupos) } };
  const scope = { assertProgramaAccessible: vi.fn().mockResolvedValue(undefined), ...scopeOverride };
  const controller = new FacilitadorRetoController(prisma as any, scope as any, {} as any, {} as any);
  return { controller, prisma, scope };
}

describe('GET facilitador/programas/:id/presentaciones (HU-03)', () => {
  it('declara @Roles(facilitador) a nivel de clase', () => {
    expect(Reflect.getMetadata(ROLES_KEY, FacilitadorRetoController)).toEqual(['facilitador']);
  });

  it('estudiante → 403 (FORBIDDEN) por RolesGuard sobre este handler', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => FacilitadorRetoController.prototype.listPresentaciones,
      getClass: () => FacilitadorRetoController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'estudiante' } }) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(AppError);
  });

  it('programa ajeno → propaga el 403 y no consulta grupos', async () => {
    const { controller, prisma } = build(GRUPOS, {
      assertProgramaAccessible: vi.fn().mockRejectedValue(new AppError('FORBIDDEN')),
    });
    await expect(controller.listPresentaciones('ajeno', FACI)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.grupo.findMany).not.toHaveBeenCalled();
  });

  it('entregados cuenta solo grupos con presentacionFinal; trae enlace y conArchivo', async () => {
    const { controller, scope, prisma } = build();
    const r = await controller.listPresentaciones('p1', FACI);
    expect(scope.assertProgramaAccessible).toHaveBeenCalledWith(expect.anything(), FACI, 'p1');
    expect(prisma.grupo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { programaId: 'p1' } }));
    expect(r.totalGrupos).toBe(2);
    expect(r.entregados).toBe(1);
    expect(r.grupos[0]).toMatchObject({
      id: 'g1',
      miembros: 3,
      entregada: true,
      entregadoEn: entrega,
      urlPresentacion: 'https://x.co/p',
      conArchivo: true,
    });
    expect(r.grupos[1]).toMatchObject({ entregada: false, entregadoEn: null, urlPresentacion: null, conArchivo: false });
  });

  it('archivoKey nunca sale en el JSON serializado', async () => {
    const { controller } = build();
    const json = JSON.stringify(await controller.listPresentaciones('p1', FACI));
    expect(json).not.toContain('archivoKey');
    expect(json).not.toContain('k/g1.pdf');
  });

  it('programa sin grupos → { totalGrupos: 0, entregados: 0, grupos: [] }', async () => {
    const { controller } = build([]);
    expect(await controller.listPresentaciones('p1', FACI)).toEqual({ totalGrupos: 0, entregados: 0, grupos: [] });
  });
});
