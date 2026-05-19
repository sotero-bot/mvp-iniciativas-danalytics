import { Controller, Post, Put, Delete, Get, Body, Param, NotFoundException, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { AgregarPasoActividadUseCase } from '../application/AgregarPasoActividadUseCase';
import { ObtenerPasosActividadUseCase } from '../application/ObtenerPasosActividadUseCase';
import { AgregarPasoDto } from './dtos/agregar-paso.dto';
import { PasoActividadResponseDto } from './dtos/paso-actividad-response.dto';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';

@Controller('admin/actividades')
export class AdminActividadesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agregarPasoUseCase: AgregarPasoActividadUseCase,
    private readonly obtenerPasosUseCase: ObtenerPasosActividadUseCase
  ) { }

  @Get(':id/pasos')
  async obtenerPasos(@Param('id') id: string) {
    try {
      const actividad = await this.prisma.actividad.findUnique({
        where: { id },
        include: { pasos: { where: { activo: true }, orderBy: { orden: 'asc' } } },
      });
      if (!actividad) throw new NotFoundException('Actividad no encontrada');
      return {
        nombre: actividad.nombre,
        pasos: actividad.pasos.map(p => new PasoActividadResponseDto({
          id: p.id,
          actividadId: p.actividadId,
          titulo: p.titulo,
          orden: p.orden,
          objetivo: p.objetivo,
          instrucciones: p.instrucciones,
          usarIa: p.usarIa,
          promptIa: p.promptIa,
          permitirArchivo: (p as any).permitirArchivo ?? false,
          urlPlantilla: (p as any).urlPlantilla || undefined,
        })),
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post(':id/pasos')
  async agregarPaso(
    @Param('id') id: string,
    @Body() dto: AgregarPasoDto
  ) {
    try {
      return await this.agregarPasoUseCase.execute({
        actividadId: id,
        ...dto
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Delete(':id/pasos/:pasoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarPaso(
    @Param('id') _id: string,
    @Param('pasoId') pasoId: string
  ) {
    await this.prisma.pasoActividad.update({
      where: { id: pasoId },
      data: { activo: false }
    });
  }

  private handleError(error: unknown): void {
    if (error instanceof ResourceNotFoundError) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof BusinessRuleViolationError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }

  @Put(':id/pasos/:pasoId')
  async actualizarPaso(
    @Param('id') id: string,
    @Param('pasoId') pasoId: string,
    @Body() dto: any
  ) {
    try {
      const res = await this.prisma.pasoActividad.update({
        where: { id: pasoId },
        data: {
          titulo: dto.titulo,
          objetivo: dto.objetivo,
          instrucciones: dto.instrucciones,
          usarIa: dto.usarIa,
          promptIa: dto.promptIa,
          orden: dto.orden,
          permitirArchivo: dto.permitirArchivo ?? false,
          urlPlantilla: dto.urlPlantilla ?? null,
        }
      });
      return res;
    } catch (error) {
      console.error(`[AdminActividadesController] ERROR UPDATING PASO:`, error);
      throw error;
    }
  }
}
