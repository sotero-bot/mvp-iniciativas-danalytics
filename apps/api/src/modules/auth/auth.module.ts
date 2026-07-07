import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './application/auth.service';
import { MagicLinkService } from './application/magic-link.service';
import { LocalStrategy } from './infrastructure/local.strategy';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { AuthController } from './infrastructure/auth.controller';
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
    PrismaService,
  ],
  controllers: [AuthController],
  exports: [AuthService, MagicLinkService, JwtModule],
})
export class AuthModule {}
