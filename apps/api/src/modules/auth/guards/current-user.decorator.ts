import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthUser } from './auth-user';

/**
 * Inyecta el `AuthUser` autenticado (poblado por `JwtAuthGuard`).
 *
 * @example
 * ```ts
 * @Get('mis-programas')
 * findMine(@CurrentUser() actor: AuthUser) { ... }
 *
 * // o un solo campo:
 * findMine(@CurrentUser('sub') usuarioId: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
