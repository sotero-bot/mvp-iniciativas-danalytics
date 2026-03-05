import { Controller, Get, Post, Body, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
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
  ) {}

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
    console.log(`[ActividadesController] POST /actividades - body:`, body);
    try {
      const res = await this.prisma.actividad.create({
        data: {
          id: randomUUID(),
          nombre: body.nombre,
          descripcion: body.descripcion,
          iniciativaId: body.iniciativaId
          // Nota: El campo pasos Json fue eliminado del schema
        }
      });
      console.log(`[ActividadesController] Actividad creada OK:`, res.id);
      return res;
    } catch (e: any) {
      console.error(`[ActividadesController] ERROR CREANDO ACTIVIDAD:`, e.message);
      throw e;
    }
  }
}
