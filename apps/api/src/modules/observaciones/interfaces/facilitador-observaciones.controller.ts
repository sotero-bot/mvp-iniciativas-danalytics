import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NivelUrgencia, TipoObservacion } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { EmailService } from '../../email/email.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

interface CreateObservacionDto {
  tipo: TipoObservacion;
  urgencia?: NivelUrgencia;
  texto: string;
  sesionId?: string | null;
  usuarioId?: string | null;
  grupoId?: string | null;
}

// RF-39/RF-40/RF-41: el facilitador reporta observaciones de su programa.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador')
@Controller('facilitador')
export class FacilitadorObservacionesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly email: EmailService,
  ) {}

  @Get('programas/:id/observaciones')
  async listPropias(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.prisma.observacionFacilitador.findMany({
      where: { programaId, autorId: actor.sub },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('programas/:id/observaciones')
  async crear(
    @Param('id') programaId: string,
    @Body() body: CreateObservacionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    const observacion = await this.prisma.observacionFacilitador.create({
      data: {
        id: randomUUID(),
        programaId,
        sesionId: body.sesionId ?? null,
        usuarioId: body.usuarioId ?? null,
        grupoId: body.grupoId ?? null,
        autorId: actor.sub,
        tipo: body.tipo,
        urgencia: body.urgencia ?? NivelUrgencia.normal,
        texto: body.texto,
      },
    });

    // RF-40/RNF-10/RNF-11: notificar a la lista configurada, best-effort (no revierte la creación).
    try {
      const urgente = observacion.urgencia === NivelUrgencia.urgente;
      const clave = urgente ? 'admins_observacion_urgente' : 'admins_observacion_normal';
      const config = await this.prisma.configuracionNotificacion.findUnique({ where: { clave } });
      const destinatarios = config?.emails ?? [];
      if (destinatarios.length > 0) {
        await this.email.sendObservacion(
          urgente,
          destinatarios,
          { programa: programa.nombre, tipo: observacion.tipo, urgencia: observacion.urgencia, texto: observacion.texto },
          { programaId, observacionId: observacion.id },
        );
        await this.prisma.observacionFacilitador.update({
          where: { id: observacion.id },
          data: { notificadoEn: new Date() },
        });
      }
    } catch (mailErr) {
      console.error('[observaciones] fallo al notificar:', mailErr);
    }

    return observacion;
  }
}
