import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

interface CreateGrupoDto {
  nombre: string;
}

interface UpdateGrupoDto {
  nombre?: string;
  orden?: number;
}

interface AddMiembroDto {
  usuarioId: string;
}

const GRUPO_SELECT = {
  id: true,
  programaId: true,
  nombre: true,
  orden: true,
  creadoPorId: true,
  createdAt: true,
  updatedAt: true,
  miembros: {
    select: {
      id: true,
      usuarioId: true,
      usuario: { select: { id: true, nombre: true, email: true } },
    },
  },
} satisfies Prisma.GrupoSelect;

// Autorización (Plan 2 §0.1, RF-14): CRUD de grupos y miembros, solo danalytics_admin.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminGruposController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('programas/:id/grupos')
  async listGrupos(@Param('id') programaId: string) {
    return this.prisma.grupo.findMany({
      where: { programaId },
      select: GRUPO_SELECT,
      orderBy: { orden: 'asc' },
    });
  }

  @Post('programas/:id/grupos')
  async createGrupo(@Param('id') programaId: string, @Body() body: CreateGrupoDto) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
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
      },
      select: GRUPO_SELECT,
    });
  }

  @Patch('grupos/:id')
  async updateGrupo(@Param('id') id: string, @Body() body: UpdateGrupoDto) {
    const existing = await this.prisma.grupo.findUnique({ where: { id } });
    if (!existing) throw new AppError('GRUPO_NOT_FOUND');
    const data: Prisma.GrupoUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.orden !== undefined) data.orden = body.orden;
    return this.prisma.grupo.update({ where: { id }, data, select: GRUPO_SELECT });
  }

  @Delete('grupos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGrupo(@Param('id') id: string) {
    const existing = await this.prisma.grupo.findUnique({ where: { id } });
    if (!existing) throw new AppError('GRUPO_NOT_FOUND');
    await this.prisma.grupo.delete({ where: { id } });
  }

  @Post('grupos/:id/miembros')
  async addMiembro(@Param('id') grupoId: string, @Body() body: AddMiembroDto) {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');

    // RN-04: el usuario debe ser participante activo del mismo programa.
    const participante = await this.prisma.participantePrograma.findFirst({
      where: { programaId: grupo.programaId, usuarioId: body.usuarioId, activo: true },
    });
    if (!participante) throw new AppError('MIEMBRO_NO_PARTICIPA');

    // RN-04: un estudiante en un solo grupo por programa (chequeo explícito +
    // el índice único @@unique([programaId, usuarioId]) como red de seguridad).
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

  @Delete('grupos/:id/miembros/:usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMiembro(@Param('id') grupoId: string, @Param('usuarioId') usuarioId: string) {
    const miembro = await this.prisma.miembroGrupo.findFirst({ where: { grupoId, usuarioId } });
    if (!miembro) throw new AppError('MIEMBRO_NO_PARTICIPA');
    await this.prisma.miembroGrupo.delete({ where: { id: miembro.id } });
  }
}
