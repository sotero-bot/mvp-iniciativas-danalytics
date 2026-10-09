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
import { MiembrosGrupoService } from '../application/miembros.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly miembros: MiembrosGrupoService,
  ) {}

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
  addMiembro(@Param('id') grupoId: string, @Body() body: AddMiembroDto) {
    return this.miembros.agregar(grupoId, body.usuarioId);
  }

  @Delete('grupos/:id/miembros/:usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMiembro(@Param('id') grupoId: string, @Param('usuarioId') usuarioId: string) {
    return this.miembros.quitar(grupoId, usuarioId);
  }

  @Post('grupos/:id/miembros/reemplazar')
  @HttpCode(HttpStatus.NO_CONTENT)
  reemplazarMiembro(@Param('id') grupoId: string, @Body() body: ReemplazarMiembroDto) {
    return this.miembros.reemplazar(grupoId, body.salienteId, body.entranteId);
  }

  @Post('grupos/:id/miembros/mover')
  @HttpCode(HttpStatus.NO_CONTENT)
  moverMiembro(@Param('id') grupoId: string, @Body() body: MoverMiembroDto) {
    return this.miembros.mover(grupoId, body.usuarioId, body.destinoGrupoId);
  }

  @Post('grupos/:id/miembros/intercambiar')
  @HttpCode(HttpStatus.NO_CONTENT)
  intercambiarMiembro(@Param('id') grupoId: string, @Body() body: IntercambiarMiembroDto) {
    return this.miembros.intercambiar(grupoId, body.usuarioId, body.conUsuarioId);
  }
}
