/**
 * Tests de autorización (Plan 2 §0.1, RNF-01/02) — regla dura "validación desde
 * la primera implementación".
 *
 * Cubre:
 * - El controller `admin/programas` declara `@Roles('danalytics_admin')` (metadata real).
 * - `RolesGuard` lanza `AppError('FORBIDDEN')` (403) para un rol no autorizado.
 * - Deja pasar al rol autorizado.
 * - Sin `@Roles(...)` deja pasar a cualquier autenticado.
 * - 403 si no hay usuario / rol nulo.
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

import {
  RolesGuard,
  ROLES_KEY,
  type RoleSlug,
} from '../../apps/api/src/modules/auth/guards';
import { AppError } from '../../apps/api/src/shared/errors/AppError';
import { AdminProgramasController } from '../../apps/api/src/modules/programas/interfaces/admin-programas.controller';

/** ExecutionContext mínimo: solo lo que RolesGuard consume. */
function mockContext(role: RoleSlug | null | undefined, hasUser = true): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => AdminProgramasController,
    switchToHttp: () => ({
      getRequest: () => (hasUser ? { user: { role } } : {}),
    }),
  } as unknown as ExecutionContext;
}

/** Reflector estampado: devuelve los roles que se le indiquen. */
function stubReflector(required: RoleSlug[] | undefined) {
  return { getAllAndOverride: () => required } as never;
}

describe('Autorización de admin/programas (regla dura §0.1)', () => {
  it('el controller declara @Roles(danalytics_admin) a nivel de clase', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminProgramasController);
    expect(roles).toEqual(['danalytics_admin']);
  });

  it('devuelve 403 (FORBIDDEN) si el rol NO es danalytics_admin', () => {
    const guard = new RolesGuard(stubReflector(['danalytics_admin']));
    try {
      guard.canActivate(mockContext('facilitador'));
      throw new Error('debió lanzar FORBIDDEN');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('FORBIDDEN');
      expect((e as AppError).statusCode).toBe(403);
    }
  });

  it('deja pasar a danalytics_admin', () => {
    const guard = new RolesGuard(stubReflector(['danalytics_admin']));
    expect(guard.canActivate(mockContext('danalytics_admin'))).toBe(true);
  });

  it('sin @Roles(...) deja pasar a cualquier usuario autenticado', () => {
    const guard = new RolesGuard(stubReflector(undefined));
    expect(guard.canActivate(mockContext('estudiante'))).toBe(true);
  });

  it('devuelve 403 si no hay usuario autenticado (rol nulo)', () => {
    const guard = new RolesGuard(stubReflector(['danalytics_admin']));
    expect(() => guard.canActivate(mockContext(null, false))).toThrowError(AppError);
  });
});
