
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

import { AuthUser, RoleSlug } from '../guards/auth-user';

/**
 * Valida el Bearer JWT y normaliza el payload `{ sub, role, empresaId }`
 * (Plan 2 §0.1) al `AuthUser` que se deja en `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.SUPABASE_JWT_SECRET || 'SECRET_KEY_MVP',
    });
  }

  async validate(payload: {
    sub: string;
    role?: RoleSlug | null;
    empresaId?: string | null;
    username?: string | null;
  }): Promise<AuthUser> {
    return {
      sub: payload.sub,
      userId: payload.sub,
      role: payload.role ?? null,
      empresaId: payload.empresaId ?? null,
      username: payload.username ?? null,
    };
  }
}
