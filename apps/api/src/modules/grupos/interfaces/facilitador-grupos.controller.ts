import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
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

    // RN-04: el usuario debe ser participante activo del mismo programa.
    const participante = await this.prisma.participantePrograma.findFirst({
      where: { programaId: grupo.programaId, usuarioId: body.usuarioId, activo: true },
      select: { id: true, confirmadoEn: true },
    });
    if (!participante) throw new AppError('MIEMBRO_NO_PARTICIPA');
    // El estudiante debe haber confirmado su registro al programa antes de entrar a un grupo.
    if (!participante.confirmadoEn) throw new AppError('MIEMBRO_NO_CONFIRMADO');

    // RN-04: un estudiante en un solo grupo por programa.
    const yaEnGrupo = await this.prisma.miembroGrupo.findFirst({
      where: { programaId: grupo.programaId, usuarioId: body.usuarioId },
    });
    if (yaEnGrupo) throw new AppError('MIEMBRO_YA_EN_GRUPO');

    try {
      return await this.prisma.miembroGrupo.create({
        data: {
          id: randomUUID(),
          grupoId,
          programaId: grupo.programaId,
          usuarioId: body.usuarioId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('MIEMBRO_YA_EN_GRUPO');
      }
      throw e;
    }
  }
}
