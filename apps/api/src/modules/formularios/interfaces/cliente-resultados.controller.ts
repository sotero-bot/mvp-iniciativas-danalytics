import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../auth/guards/auth-user';
import type { AuthUser } from '../../auth/guards';
import { ResultadosService } from '../application/resultados.service';

// Autorización (Plan 2 §0.1, RF-35/RN-09): roles cliente ven el diagnóstico
// agregado de los programas de SU empresa (misma vista que el facilitador,
// solo lectura). El scoping por empresaId lo aplica assertProgramaAccessible.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CLIENTE_ROLE_SLUGS)
@Controller('cliente')
export class ClienteResultadosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly resultados: ResultadosService,
  ) {}

  @Get('programas/:id/diagnostico/agregado')
  async diagnosticoAgregado(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.resultados.diagnosticoAgregado(programaId);
  }
}
