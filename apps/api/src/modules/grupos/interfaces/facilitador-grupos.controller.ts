import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
interface UpdateGrupoDto {
  nombre: string;
}
interface AddMiembroDto {
  usuarioId: string;
}
interface MoverMiembroDto {
  usuarioId: string;
  destinoGrupoId: string;
}
interface IntercambiarMiembroDto {
  usuarioId: string;
  conUsuarioId: string;
}
interface ReemplazarMiembroDto {
  salienteId: string;
  entranteId: string;
}

// RF-15 + C-02 (aclaración 2026-07-14): el facilitador ve los grupos de su programa,
// y puede CREAR grupos y ASIGNAR integrantes.
// HU-21/HU-22 (2026-10) REVIERTEN la restricción original de C-02 (solo alta): ahora
// también puede RENOMBRAR grupos y QUITAR/REEMPLAZAR integrantes (ya no existe el
// mínimo de 2 integrantes por grupo). Sigue sin poder
// eliminar grupos ni cambiar su orden (exclusivo del admin, AdminGruposController).
// Registrar/matricular sigue siendo solo del admin: aquí solo se opera sobre
// estudiantes ya matriculados.
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

  // C-02: asignar un integrante (participante ya matriculado).
  @Post('grupos/:id/miembros')
  async addMiembro(
    @Param('id') grupoId: string,
    @Body() body: AddMiembroDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.assertGrupoEditable(grupoId, actor);
    return this.miembros.agregar(grupoId, body.usuarioId);
  }

  // HU-22: renombrar. Solo `nombre`; reordenar sigue siendo del admin.
  @Patch('grupos/:id')
  async updateGrupo(
    @Param('id') grupoId: string,
    @Body() body: UpdateGrupoDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.assertGrupoEditable(grupoId, actor);
    return this.prisma.grupo.update({
      where: { id: grupoId },
      data: { nombre: body.nombre },
      select: GRUPO_SELECT,
    });
  }

  // HU-21: quitar integrante (sin mínimo de integrantes por grupo).
  @Delete('grupos/:id/miembros/:usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMiembro(
    @Param('id') grupoId: string,
    @Param('usuarioId') usuarioId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.assertGrupoEditable(grupoId, actor);
    return this.miembros.quitar(grupoId, usuarioId);
  }

  // HU-21: reemplazo atómico saliente→entrante; válido también en grupos de 2.
  @Post('grupos/:id/miembros/reemplazar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reemplazarMiembro(
    @Param('id') grupoId: string,
    @Body() body: ReemplazarMiembroDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.assertGrupoEditable(grupoId, actor);
    return this.miembros.reemplazar(grupoId, body.salienteId, body.entranteId);
  }

  // HU-21: mover un integrante a otro grupo del mismo programa (el servicio valida el programa).
  @Post('grupos/:id/miembros/mover')
  @HttpCode(HttpStatus.NO_CONTENT)
  async moverMiembro(
    @Param('id') grupoId: string,
    @Body() body: MoverMiembroDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.assertGrupoEditable(grupoId, actor);
    return this.miembros.mover(grupoId, body.usuarioId, body.destinoGrupoId);
  }

  // HU-21: intercambiar a dos integrantes de dos grupos distintos.
  @Post('grupos/:id/miembros/intercambiar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async intercambiarMiembro(
    @Param('id') grupoId: string,
    @Body() body: IntercambiarMiembroDto,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.assertGrupoEditable(grupoId, actor);
    return this.miembros.intercambiar(grupoId, body.usuarioId, body.conUsuarioId);
  }

  // Las rutas de grupo reciben el id del grupo: se carga primero para obtener su
  // programa. GRUPO_NOT_FOUND va antes del chequeo de scope.
  private async assertGrupoEditable(grupoId: string, actor: AuthUser) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');
    await this.scope.assertProgramaEditable(this.prisma, actor, grupo.programaId);
  }
}
