import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { FichaEstudianteService } from '../application/ficha-estudiante.service';

// HU-16: ficha por estudiante para el facilitador. Lectura: `assertProgramaAccessible`
// (funciona con la gracia vencida). Ve el entregable del reto; nunca respuestas ni scores.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador')
@Controller('facilitador')
export class FacilitadorParticipantesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly fichaService: FichaEstudianteService,
  ) {}

  @Get('programas/:id/participantes/resumen')
  async resumen(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.fichaService.resumen(programaId);
  }

  @Get('programas/:id/participantes/:usuarioId/ficha')
  async ficha(
    @Param('id') programaId: string,
    @Param('usuarioId') usuarioId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.fichaService.build(programaId, usuarioId, { verEntregable: true });
  }
}
