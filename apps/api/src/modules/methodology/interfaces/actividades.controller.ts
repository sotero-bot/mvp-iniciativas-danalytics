import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';
import { AgregarPasoActividadUseCase } from '../application/AgregarPasoActividadUseCase';
import { InstanciarPlantillaUseCase } from '../application/InstanciarPlantillaUseCase';
import { AgregarPasoDto } from './dtos/agregar-paso.dto';

@Controller('methodology/actividades')
export class ActividadesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agregarPasoUseCase: AgregarPasoActividadUseCase,
    private readonly instanciarPlantillaUseCase: InstanciarPlantillaUseCase,
  ) { }

  @Get()
  async findAll(@Query('iniciativaId') iniciativaId?: string) {
    if (iniciativaId) {
      return this.prisma.actividad.findMany({ where: { iniciativaId, activo: true } });
    }
    return this.prisma.actividad.findMany({
      where: { activo: true },
      include: {
        iniciativa: { include: { empresa: true } },
        plantillaOrigen: { select: { id: true, nombre: true } },
      },
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; descripcion?: string; iniciativaId: string; plantillaId?: string }) {
    if (body.plantillaId) {
      return this.instanciarPlantillaUseCase.execute(body.plantillaId, body.iniciativaId, body.nombre, body.descripcion);
    }
    return this.prisma.actividad.create({
      data: {
        id: randomUUID(),
        nombre: body.nombre,
        descripcion: body.descripcion,
        iniciativaId: body.iniciativaId,
      },
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { nombre: string; descripcion: string; iniciativaId: string }
  ) {
    return this.prisma.actividad.update({
      where: { id },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        iniciativaId: body.iniciativaId
      }
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string) {
    await this.prisma.instanciaActividad.updateMany({
      where: { actividadId: id },
      data: { activo: false }
    });
    await this.prisma.pasoActividad.updateMany({
      where: { actividadId: id },
      data: { activo: false }
    });
    await this.prisma.actividad.update({
      where: { id },
      data: { activo: false }
    });
  }
}
