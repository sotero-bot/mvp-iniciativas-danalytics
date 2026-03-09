import { Controller, Get, Post, Put, Body, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';
import { AgregarPasoActividadUseCase } from '../application/AgregarPasoActividadUseCase';
import { AgregarPasoDto } from './dtos/agregar-paso.dto';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';

@Controller('methodology/actividades')
export class ActividadesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agregarPasoUseCase: AgregarPasoActividadUseCase
  ) { }

  @Get()
  async findAll(@Query('iniciativaId') iniciativaId?: string) {
    console.log(`[ActividadesController] GET /actividades - iniciativaId: ${iniciativaId}`);
    if (iniciativaId) {
      return this.prisma.actividad.findMany({ where: { iniciativaId } });
    }
    return this.prisma.actividad.findMany({
      include: { iniciativa: { include: { empresa: true } } }
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; descripcion: string; iniciativaId: string }) {
    try {
      const res = await this.prisma.actividad.create({
        data: {
          id: randomUUID(),
          nombre: body.nombre,
          descripcion: body.descripcion,
          iniciativaId: body.iniciativaId
        }
      });
      return res;
    } catch (e: any) {
      console.error(`[ActividadesController] ERROR CREANDO ACTIVIDAD:`, e.message);
      throw e;
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { nombre: string; descripcion: string; iniciativaId: string }
  ) {
    try {
      const res = await this.prisma.actividad.update({
        where: { id },
        data: {
          nombre: body.nombre,
          descripcion: body.descripcion,
          iniciativaId: body.iniciativaId
        }
      });
      return res;
    } catch (e: any) {
      console.error(`[ActividadesController] ERROR UPDATING ACTIVIDAD:`, e.message);
      throw e;
    }
  }
}
