import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';

const GRUPO_SELECT = {
  id: true,
  programaId: true,
  nombre: true,
  orden: true,
  miembros: {
    select: {
      id: true,
      usuarioId: true,
      usuario: { select: { id: true, nombre: true, email: true } },
    },
  },
} satisfies Prisma.GrupoSelect;

// RF-15: el facilitador ve los grupos de su programa en solo lectura.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador')
@Controller('facilitador')
export class FacilitadorGruposController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
  ) {}

  @Get('programas/:id/grupos')
  async listGrupos(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.prisma.grupo.findMany({
      where: { programaId },
      select: GRUPO_SELECT,
      orderBy: { orden: 'asc' },
    });
  }
}
