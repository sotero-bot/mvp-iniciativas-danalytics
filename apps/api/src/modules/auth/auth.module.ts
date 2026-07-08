import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './application/auth.service';
import { MagicLinkService } from './application/magic-link.service';
import { LocalStrategy } from './infrastructure/local.strategy';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { GoogleStrategy } from './infrastructure/google.strategy';
import { AuthController } from './infrastructure/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ActorScopeService } from './scoping/actor-scope.service';
import { PrismaService } from '../../prisma.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.SUPABASE_JWT_SECRET || 'SECRET_KEY_MVP',
      signOptions: { expiresIn: '60m' },
    }),
    EmailModule,
  ],
  providers: [
    AuthService,
    MagicLinkService,
    LocalStrategy,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    ActorScopeService,
    PrismaService,
    // GoogleStrategy se registra SOLO si hay credenciales; sin ellas, construir la
    // estrategia lanzaría ("OAuth2Strategy requires a clientID"). Si falta, /auth/google
    // simplemente no tendrá estrategia y devolverá error hasta que se configure el .env.
    {
      provide: GoogleStrategy,
      useFactory: (prisma: PrismaService) =>
        process.env.GOOGLE_CLIENT_ID ? new GoogleStrategy(prisma) : null,
      inject: [PrismaService],
    },
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    MagicLinkService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    ActorScopeService,
  ],
})
export class AuthModule {}
