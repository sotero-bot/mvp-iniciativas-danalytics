import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AppError } from '../../../shared/errors/AppError';

/**
 * Guard base de autenticación (Plan 2 §0.1). Valida el Bearer JWT vía la
 * `JwtStrategy` y deja el `AuthUser` en `req.user`.
 *
 * A diferencia del `AuthGuard('jwt')` crudo (que lanza `UnauthorizedException`),
 * traduce los fallos a `AppError` con códigos semánticos, para que
 * `ErrorCodeFilter` los serialice como `{ code, message, statusCode }` y el
 * frontend los mapee a `t('errors:CODE')`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      // `info` es un Error de passport-jwt: "No auth token" / "jwt expired" / etc.
      const reason = info instanceof Error ? info.message : String(info ?? '');
      if (/no auth token/i.test(reason)) {
        throw new AppError('AUTH_TOKEN_MISSING');
      }
      throw new AppError('AUTH_TOKEN_INVALID', { message: reason || undefined });
    }
    return user;
  }
}
