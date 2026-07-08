import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

import { AuthService } from '../application/auth.service';
import { MagicLinkService } from '../application/magic-link.service';
import { CurrentUser } from '../guards/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthUser } from '../guards/auth-user';

interface MagicLinkConsumeDto {
  token: string;
}

interface MagicLinkRequestDto {
  email: string;
  locale?: 'es' | 'pt';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly magicLink: MagicLinkService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.sub);
  }

  @Post('magic-link/consume')
  async consumeMagicLink(@Body() body: MagicLinkConsumeDto, @Ip() ip: string) {
    return this.magicLink.consume(body?.token, ip);
  }

  @Post('magic-link/request')
  async requestMagicLink(@Body() body: MagicLinkRequestDto, @Ip() ip: string) {
    await this.magicLink.requestByEmail(body?.email, ip, body?.locale);
    return { ok: true };
  }

  // ── OAuth2 Google (RF-13, §1.1) ────────────────────────────────────────
  // Solo operativos si GOOGLE_CLIENT_ID está configurado (GoogleStrategy se
  // registra condicionalmente en auth.module).

  /** Inicia el flujo OAuth: passport redirige a la pantalla de consentimiento de Google. */
  @UseGuards(AuthGuard('google'))
  @Get('google')
  async googleAuth() {
    // El guard hace el redirect; este handler nunca ejecuta cuerpo.
  }

  /**
   * Callback de Google. `GoogleStrategy.validate` ya dejó el `AuthUser` en `req.user`
   * (o devolvió 4xx si el usuario no está registrado / dominio no autorizado).
   * Firma el JWT y redirige al frontend con el token.
   */
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Req() req: { user: AuthUser }, @Res() res: Response) {
    const { access_token } = this.authService.loginFromAuthUser(req.user);
    const base = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
    return res.redirect(`${base}/auth/google/callback?token=${encodeURIComponent(access_token)}`);
  }
}
