import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';

@Controller('organization/iniciativas')
export class IniciativasController {
  constructor(private readonly prisma: PrismaService) { }

  @Get()
  async findAll(@Query('empresaId') empresaId?: string) {
    if (empresaId) {
      return this.prisma.iniciativa.findMany({
        where: { empresaId, activo: true }
      });
    }
    return this.prisma.iniciativa.findMany({
      where: { activo: true },
      include: { empresa: true }
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; descripcion?: string; empresaId: string }) {
    try {
      const res = await this.prisma.iniciativa.create({
        data: {
          id: randomUUID(),
          nombre: body.nombre,
          descripcion: body.descripcion,
          empresaId: body.empresaId
        }
      });
      return res;
    } catch (e: any) {
      throw e;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.iniciativa.findUnique({
      where: { id },
      include: { empresa: true, actividades: { where: { activo: true } } }
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { nombre?: string; descripcion?: string; empresaId?: string }) {
    return this.prisma.iniciativa.update({
      where: { id },
      data: {
        ...(body.nombre && { nombre: body.nombre }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
        ...(body.empresaId && { empresaId: body.empresaId }),
      },
      include: { empresa: true }
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string) {
    const actividades = await this.prisma.actividad.findMany({
      where: { iniciativaId: id },
      select: { id: true }
    });
    const actividadIds = actividades.map(a => a.id);

    await this.prisma.instanciaActividad.updateMany({
      where: { actividadId: { in: actividadIds } },
      data: { activo: false }
    });
    await this.prisma.pasoActividad.updateMany({
      where: { actividadId: { in: actividadIds } },
      data: { activo: false }
    });
    await this.prisma.actividad.updateMany({
      where: { id: { in: actividadIds } },
      data: { activo: false }
    });
    await this.prisma.iniciativa.update({
      where: { id },
      data: { activo: false }
    });
  }
}
