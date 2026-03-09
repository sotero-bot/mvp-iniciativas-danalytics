import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';

@Controller('organization/empresas')
export class EmpresasController {
  constructor(private readonly prisma: PrismaService) { }

  @Get()
  async findAll() {
    return this.prisma.empresa.findMany({ where: { activo: true } });
  }

  @Post()
  async create(@Body() body: { nombre: string }) {
    return this.prisma.empresa.create({
      data: {
        id: randomUUID(),
        nombre: body.nombre
      }
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { nombre: string }) {
    return this.prisma.empresa.update({
      where: { id },
      data: { nombre: body.nombre }
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string) {
    // Cascade: deactivate instancias of all actividades
    const actividades = await this.prisma.actividad.findMany({
      where: { iniciativa: { empresaId: id } },
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
    await this.prisma.iniciativa.updateMany({
      where: { empresaId: id },
      data: { activo: false }
    });
    await this.prisma.empresa.update({
      where: { id },
      data: { activo: false }
    });
  }
}
