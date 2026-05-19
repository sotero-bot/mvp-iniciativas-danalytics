import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Controller('admin/plantillas/:plantillaId/pasos')
export class AdminPlantillaPasosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Param('plantillaId') plantillaId: string) {
    const plantilla = await this.prisma.plantillaActividad.findUnique({
      where: { id: plantillaId, activo: true },
      include: { pasos: { where: { activo: true }, orderBy: { orden: 'asc' } } },
    });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');
    return { nombre: plantilla.nombre, pasos: plantilla.pasos };
  }

  @Post()
  async create(
    @Param('plantillaId') plantillaId: string,
    @Body() body: { titulo: string; objetivo?: string; instrucciones?: string; usarIa?: boolean; promptIa?: string; orden: number; permitirArchivo?: boolean; urlPlantilla?: string },
  ) {
    const plantilla = await this.prisma.plantillaActividad.findUnique({ where: { id: plantillaId, activo: true } });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');

    const existe = await this.prisma.pasoPlantilla.findFirst({
      where: { plantillaId, orden: body.orden, activo: true },
    });
    if (existe) throw new BadRequestException(`Ya existe un paso con orden ${body.orden} en esta plantilla`);

    return this.prisma.pasoPlantilla.create({
      data: {
        plantillaId,
        titulo: body.titulo,
        objetivo: body.objetivo,
        instrucciones: body.instrucciones,
        usarIa: body.usarIa ?? false,
        promptIa: body.promptIa,
        orden: body.orden,
        permitirArchivo: body.permitirArchivo ?? false,
        urlPlantilla: body.urlPlantilla ?? null,
      },
    });
  }

  @Put(':pasoId')
  async update(
    @Param('plantillaId') plantillaId: string,
    @Param('pasoId') pasoId: string,
    @Body() body: { titulo: string; objetivo?: string; instrucciones?: string; usarIa?: boolean; promptIa?: string; orden: number; permitirArchivo?: boolean; urlPlantilla?: string },
  ) {
    const existe = await this.prisma.pasoPlantilla.findFirst({
      where: { plantillaId, orden: body.orden, activo: true, NOT: { id: pasoId } },
    });
    if (existe) throw new BadRequestException(`Ya existe un paso con orden ${body.orden} en esta plantilla`);

    return this.prisma.pasoPlantilla.update({
      where: { id: pasoId },
      data: {
        titulo: body.titulo,
        objetivo: body.objetivo,
        instrucciones: body.instrucciones,
        usarIa: body.usarIa ?? false,
        promptIa: body.promptIa,
        orden: body.orden,
        permitirArchivo: body.permitirArchivo ?? false,
        urlPlantilla: body.urlPlantilla ?? null,
      },
    });
  }

  @Delete(':pasoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('pasoId') pasoId: string) {
    await this.prisma.pasoPlantilla.update({
      where: { id: pasoId },
      data: { activo: false },
    });
  }
}
