import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NivelUrgencia, TipoObservacion } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';

// RF-41: el admin ve el historial completo de observaciones, con filtros.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminObservacionesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('observaciones')
  async list(
    @Query('programaId') programaId?: string,
    @Query('urgencia') urgencia?: NivelUrgencia,
    @Query('tipo') tipo?: TipoObservacion,
  ) {
    return this.prisma.observacionFacilitador.findMany({
      where: {
        ...(programaId ? { programaId } : {}),
        ...(urgencia ? { urgencia } : {}),
        ...(tipo ? { tipo } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
