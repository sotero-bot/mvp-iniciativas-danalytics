import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../auth/guards/auth-user';
import type { AuthUser } from '../../auth/guards';
import { assertProgramaCliente } from '../../portal/application/cliente-scope';
import { filtroUsuarioPorArea } from '../../portal/application/filtro-area';
import { FichaEstudianteService } from '../application/ficha-estudiante.service';

// HU-16: el cliente ve el estado de sus participantes. C-07/RN-09: `assertProgramaCliente`
// (empresa + asignación) — NO una comparación de `empresaId`, que dejaría a un usuario_cliente
// leer programas no asignados. RN-07: sin entregable (`verEntregable: false`).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CLIENTE_ROLE_SLUGS)
@Controller('portal')
export class ClienteParticipantesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fichaService: FichaEstudianteService,
  ) {}

  @Get('programas/:id/participantes')
  async listar(
    @Param('id') programaId: string,
    @CurrentUser() actor: AuthUser,
    @Query('areaId') areaId?: string, // HU-14
  ) {
    await assertProgramaCliente(this.prisma, actor, programaId);
    return this.fichaService.resumen(programaId, filtroUsuarioPorArea(areaId));
  }

  @Get('programas/:id/participantes/:usuarioId/ficha')
  async ficha(
    @Param('id') programaId: string,
    @Param('usuarioId') usuarioId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    await assertProgramaCliente(this.prisma, actor, programaId);
    return this.fichaService.build(programaId, usuarioId, { verEntregable: false });
  }
}
