import { Controller, Post, Put, Get, Body, Param, NotFoundException, BadRequestException } from '@nestjs/common';
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
      const pasos = await this.obtenerPasosUseCase.execute(id);
      return pasos.map(p => new PasoActividadResponseDto({
        id: p.id,
        actividadId: p.actividadId,
        titulo: p.titulo,
        orden: p.orden,
        objetivo: p.objetivo,
        instrucciones: p.instrucciones,
        promptIa: p.promptIa
      }));
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
          orden: dto.orden
        }
      });
      return res;
    } catch (error) {
      console.error(`[AdminActividadesController] ERROR UPDATING PASO:`, error);
      throw error;
    }
  }
}
