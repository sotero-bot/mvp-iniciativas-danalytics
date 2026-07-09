import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EstadoEnvio } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { EmailService } from '../../email/email.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

interface PutConfiguracionDto {
  emails: string[];
  descripcion?: string | null;
}

// RNF-12/RF-40: bitácora de emails transaccionales + listas de destinatarios configurables.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminNotificacionesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Get('notificaciones')
  async list(@Query('estado') estado?: EstadoEnvio) {
    return this.prisma.notificacionEmail.findMany({
      where: estado ? { estado } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Post('notificaciones/:id/reenviar')
  async reenviar(@Param('id') id: string) {
    await this.email.resend(id);
    return this.prisma.notificacionEmail.findUnique({ where: { id } });
  }

  @Get('configuracion-notificaciones')
  async listConfiguracion() {
    return this.prisma.configuracionNotificacion.findMany({ orderBy: { clave: 'asc' } });
  }

  @Put('configuracion-notificaciones/:clave')
  async upsertConfiguracion(@Param('clave') clave: string, @Body() body: PutConfiguracionDto) {
    if (!Array.isArray(body.emails)) {
      throw new AppError('VALIDATION_ERROR', { message: 'emails debe ser un array de strings' });
    }
    return this.prisma.configuracionNotificacion.upsert({
      where: { clave },
      create: { id: randomUUID(), clave, emails: body.emails, descripcion: body.descripcion ?? null },
      update: { emails: body.emails, descripcion: body.descripcion ?? undefined },
    });
  }
}
