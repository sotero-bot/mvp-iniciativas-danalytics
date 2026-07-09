import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { AuthUser, RoleSlug } from '../guards/auth-user';

/**
 * Login con Google OAuth2 (RF-13, Plan 2 §1.1).
 *
 * Reglas duras:
 * - **Nunca crea usuarios**: solo autentica a `Usuario` ya persistidos, activos y con
 *   `puedeIniciarSesion=true` (mismo criterio que el magic link).
 * - Emite el **mismo `AuthUser`** que el resto de flujos; el JWT final lo firma el controller
 *   con `{ sub, role, empresaId }` (contrato §0.1/§1.1 para que los guards funcionen igual).
 *
 * Se registra SOLO si `GOOGLE_CLIENT_ID` está definido (ver `auth.module.ts`); sin credenciales
 * el `super()` de passport-google-oauth20 lanzaría al construir.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly prisma: PrismaService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:3001/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase().trim();
      // passport-google-oauth20 expone email_verified en el JSON crudo.
      const emailVerified = (profile._json as { email_verified?: boolean })?.email_verified;

      if (!email) throw new AppError('OAUTH_USUARIO_NO_REGISTRADO');
      if (emailVerified === false) throw new AppError('OAUTH_EMAIL_NO_VERIFICADO');

      // Match determinista por `username` (== email). `username` es @unique global, así que
      // devuelve UN solo usuario; `email` solo es único por empresa y podría estar duplicado
      // (p. ej. mismo correo como admin sin empresa y como estudiante con empresa) → antes
      // `findFirst({email})` devolvía uno arbitrario y podías entrar con el rol equivocado.
      // Fallback a email para usuarios legacy cuyo username aún no es el email.
      let usuario = await this.prisma.usuario.findUnique({
        where: { username: email },
        include: { role: true, empresa: true },
      });
      if (!usuario) {
        usuario = await this.prisma.usuario.findFirst({
          where: { email, activo: true, puedeIniciarSesion: true },
          include: { role: true, empresa: true },
        });
      }
      // NUNCA crear usuarios desde OAuth — solo usuarios ya persistidos (regla dura del proyecto).
      if (!usuario || !usuario.activo || !usuario.puedeIniciarSesion) {
        throw new AppError('OAUTH_USUARIO_NO_REGISTRADO');
      }

      // Si la empresa del usuario declara dominio Workspace, el correo debe pertenecer a él.
      const dominio = email.split('@')[1];
      const dominioEmpresa = usuario.empresa?.dominioGoogleWorkspace?.toLowerCase();
      if (dominioEmpresa && dominioEmpresa !== dominio) {
        throw new AppError('OAUTH_DOMINIO_NO_AUTORIZADO');
      }

      // Vincula/confirma la identidad de Google en el usuario ya existente.
      // `googleId` es @unique: si otra fila (un duplicado histórico con el mismo correo) ya lo
      // tiene, se lo quitamos ANTES de asignarlo aquí, para no violar la unicidad y "reclamar"
      // la identidad al usuario canónico (el del match por username=email). Transacción atómica.
      await this.prisma.$transaction([
        this.prisma.usuario.updateMany({
          where: { googleId: profile.id, NOT: { id: usuario.id } },
          data: { googleId: null },
        }),
        this.prisma.usuario.update({
          where: { id: usuario.id },
          data: { googleId: profile.id, googleEmailVerificado: true },
        }),
      ]);

      const authUser: AuthUser = {
        sub: usuario.id,
        userId: usuario.id,
        role: (usuario.role?.slug as RoleSlug) ?? null,
        empresaId: usuario.empresaId ?? null,
        username: usuario.username ?? null,
      };
      done(null, authUser);
    } catch (e) {
      done(e as Error, false);
    }
  }
}
