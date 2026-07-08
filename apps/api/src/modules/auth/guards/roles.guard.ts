import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppError } from '../../../shared/errors/AppError';
import { AuthUser, RoleSlug } from './auth-user';
import { ROLES_KEY } from './roles.decorator';

/**
 * Autorización por rol (Plan 2 §0.1, RNF-01).
 *
 * Debe ejecutarse DESPUÉS de `JwtAuthGuard` (que puebla `req.user`):
 * `@UseGuards(JwtAuthGuard, RolesGuard)`. Lee los roles declarados con
 * `@Roles(...)` (a nivel de método, con precedencia sobre la clase) y los
 * compara contra `req.user.role`.
 *
 * - Sin `@Roles(...)` → pasa cualquier usuario autenticado.
 * - Rol no incluido → `AppError('FORBIDDEN')` (403, RNF-02).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleSlug[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const role = req.user?.role;

    if (!role || !required.includes(role)) {
      throw new AppError('FORBIDDEN');
    }
    return true;
  }
}
