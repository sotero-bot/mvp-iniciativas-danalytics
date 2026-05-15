import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Controller('admin/plantillas')
export class AdminPlantillasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    return this.prisma.plantillaActividad.findMany({
      where: { activo: true },
      include: { _count: { select: { pasos: { where: { activo: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; descripcion?: string }) {
    return this.prisma.plantillaActividad.create({
      data: { nombre: body.nombre, descripcion: body.descripcion },
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { nombre: string; descripcion?: string },
  ) {
    const exists = await this.prisma.plantillaActividad.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Plantilla no encontrada');
    return this.prisma.plantillaActividad.update({
      where: { id },
      data: { nombre: body.nombre, descripcion: body.descripcion },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.prisma.pasoPlantilla.updateMany({
      where: { plantillaId: id },
      data: { activo: false },
    });
    await this.prisma.plantillaActividad.update({
      where: { id },
      data: { activo: false },
    });
  }
}
