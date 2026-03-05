import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { GenerarInstanciaUseCase } from '../application/GenerarInstanciaUseCase';
import { ObtenerInstanciaDetalleUseCase } from '../application/ObtenerInstanciaDetalleUseCase';
import { PrismaService } from '../../../prisma.service';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

@Controller('admin/instancias')
export class AdminExecutionController {
  constructor(
    private readonly generarUseCase: GenerarInstanciaUseCase,
    private readonly obtenerDetalleUseCase: ObtenerInstanciaDetalleUseCase,
    private readonly prisma: PrismaService
  ) { }

  @Post('generar')
  async generar(@Body() body: { actividadId: string; emailReferencia?: string }) {
    const result = await this.generarUseCase.execute(body.actividadId, body.emailReferencia);
    return { id: result.id, accessToken: result.accessToken };
  }

  @Get()
  async listAll() {
    return this.prisma.instanciaActividad.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        actividad: {
          include: {
            iniciativa: {
              include: { empresa: true }
            }
          }
        },
        usuario: true
      }
    });
  }

  @Get(':id')
  async obtenerDetalle(@Param('id') id: string) {
    try {
      return await this.obtenerDetalleUseCase.execute(id);
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
