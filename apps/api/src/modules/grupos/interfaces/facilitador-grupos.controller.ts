import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { MiembrosGrupoService } from '../application/miembros.service';
import { AppError } from '../../../shared/errors/AppError';

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

interface CreateGrupoDto {
  nombre: string;
}
interface AddMiembroDto {
  usuarioId: string;
}

// RF-15 + C-02 (aclaración 2026-07-14): el facilitador ve los grupos de su programa,
// y además puede CREAR grupos y ASIGNAR integrantes. NO puede modificar integrantes
// ya asignados (sin quitar), ni renombrar/eliminar grupos: eso queda exclusivo del
// admin (AdminGruposController). Registrar/matricular sigue siendo solo del admin.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador')
@Controller('facilitador')
export class FacilitadorGruposController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly miembros: MiembrosGrupoService,
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

  // C-02: roster de participantes activos del programa (lectura) para poder asignar
  // integrantes desde el portal facilitador. NO permite matricular (solo lectura).
  @Get('programas/:id/participantes')
  async listParticipantes(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    return this.prisma.participantePrograma.findMany({
      where: { programaId, activo: true },
      select: { usuarioId: true, usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // C-02: crear grupo en un programa del facilitador.
  @Post('programas/:id/grupos')
  async createGrupo(
    @Param('id') programaId: string,
    @Body() body: CreateGrupoDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.scope.assertProgramaEditable(this.prisma, actor, programaId);
    const last = await this.prisma.grupo.findFirst({
      where: { programaId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });
    return this.prisma.grupo.create({
      data: {
        id: randomUUID(),
        programaId,
        nombre: body.nombre,
        orden: (last?.orden ?? 0) + 1,
        creadoPorId: actor.sub,
      },
      select: GRUPO_SELECT,
    });
  }

  // C-02: asignar un integrante (participante ya matriculado). NO hay endpoint de
  // quitar integrante para el facilitador: una vez asignado, solo el admin lo cambia.
  @Post('grupos/:id/miembros')
  async addMiembro(
    @Param('id') grupoId: string,
    @Body() body: AddMiembroDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');
    await this.scope.assertProgramaEditable(this.prisma, actor, grupo.programaId);
    return this.miembros.agregar(grupoId, body.usuarioId);
  }
}
