import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { ResultadosService } from '../application/resultados.service';

// Autorización (Plan 2 §0.1, RF-33/RF-36/RN-06/RN-07): el facilitador ve SOLO
// agregados de su programa — sin individuales, sin export, feedback anónimo.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador')
@Controller('facilitador')
export class FacilitadorResultadosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly resultados: ResultadosService,
  ) {}

  // RF-33: promedio por dimensión, inicial y final. Nada individual.
  @Get('programas/:id/diagnostico/agregado')
  async diagnosticoAgregado(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.resultados.diagnosticoAgregado(programaId);
  }

  // RF-36/RN-06: feedback agregado y anónimo — ninguna respuesta se vincula a un usuario.
  @Get('programas/:id/feedback/agregado')
  async feedbackAgregado(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.resultados.feedbackAgregado(programaId);
  }
}
