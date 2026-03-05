
import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { LocalStrategy } from './infrastructure/local.strategy';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { PrismaService } from '../../prisma.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './infrastructure/auth.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.SUPABASE_JWT_SECRET || 'SECRET_KEY_MVP',
      signOptions: { expiresIn: '60m' },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, PrismaService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule { }
