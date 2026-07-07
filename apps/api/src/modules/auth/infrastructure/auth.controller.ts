import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from '../application/auth.service';
import { MagicLinkService } from '../application/magic-link.service';

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

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
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
}
