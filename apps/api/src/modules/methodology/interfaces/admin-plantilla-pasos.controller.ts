import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';

@Controller('admin/plantillas/:plantillaId/pasos')
export class AdminPlantillaPasosController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findAll(@Param('plantillaId') plantillaId: string) {
    const plantilla = await this.prisma.plantillaActividad.findUnique({
      where: { id: plantillaId, activo: true },
      include: {
        pasos: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
        },
      },
    });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');
    return { nombre: plantilla.nombre, pasos: plantilla.pasos };
  }

  @Post()
  async create(
    @Param('plantillaId') plantillaId: string,
    @Body() body: { titulo: string; objetivo?: string; instrucciones?: string; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; orden: number; permitirArchivo?: boolean; soloArchivo?: boolean; urlPlantilla?: string },
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
        iaAutomatica: body.usarIa ? (body.iaAutomatica ?? false) : false,
        promptIa: body.promptIa,
        orden: body.orden,
        permitirArchivo: body.permitirArchivo ?? false,
        soloArchivo: body.soloArchivo ?? false,
        urlPlantilla: body.urlPlantilla ?? null,
      },
    });
  }

  @Put(':pasoId')
  async update(
    @Param('plantillaId') plantillaId: string,
    @Param('pasoId') pasoId: string,
    @Body() body: { titulo: string; objetivo?: string; instrucciones?: string; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; orden: number; permitirArchivo?: boolean; soloArchivo?: boolean; urlPlantilla?: string },
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
        iaAutomatica: body.usarIa ? (body.iaAutomatica ?? false) : false,
        promptIa: body.promptIa,
        orden: body.orden,
        permitirArchivo: body.permitirArchivo ?? false,
        soloArchivo: body.soloArchivo ?? false,
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

  // ── Preguntas ────────────────────────────────────────────────────────────────

  @Get(':pasoId/preguntas')
  async findPreguntas(@Param('pasoId') pasoId: string) {
    const paso = await this.prisma.pasoPlantilla.findUnique({
      where: { id: pasoId },
      include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
    });
    if (!paso) throw new NotFoundException('Paso no encontrado');
    return paso.preguntas;
  }

  @Post(':pasoId/preguntas')
  async createPregunta(
    @Param('pasoId') pasoId: string,
    @Body() body: { orden: number; enunciado: string; permitirArchivo?: boolean; soloArchivo?: boolean; subirArchivoS3?: boolean; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; urlPlantilla?: string; urlPromptTemplate?: string },
  ) {
    const paso = await this.prisma.pasoPlantilla.findUnique({ where: { id: pasoId } });
    if (!paso) throw new NotFoundException('Paso no encontrado');
    const existe = await this.prisma.preguntaPlantilla.findFirst({ where: { pasoId, orden: body.orden, activo: true } });
    if (existe) throw new BadRequestException(`Ya existe una pregunta con orden ${body.orden} en este paso`);
    return this.prisma.preguntaPlantilla.create({
      data: {
        id: randomUUID(),
        pasoId,
        orden: body.orden,
        enunciado: body.enunciado,
        permitirArchivo: body.permitirArchivo ?? false,
        soloArchivo: body.soloArchivo ?? false,
        subirArchivoS3: body.subirArchivoS3 ?? false,
        usarIa: body.usarIa ?? false,
        iaAutomatica: (body.usarIa ?? false) ? (body.iaAutomatica ?? false) : false,
        promptIa: body.promptIa ?? null,
        urlPlantilla: body.urlPlantilla ?? null,
        urlPromptTemplate: body.urlPromptTemplate ?? null,
      },
    });
  }

  @Put(':pasoId/preguntas/:preguntaId')
  async updatePregunta(
    @Param('pasoId') pasoId: string,
    @Param('preguntaId') preguntaId: string,
    @Body() body: { orden: number; enunciado: string; permitirArchivo?: boolean; soloArchivo?: boolean; subirArchivoS3?: boolean; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; urlPlantilla?: string; urlPromptTemplate?: string },
  ) {
    const existe = await this.prisma.preguntaPlantilla.findFirst({
      where: { pasoId, orden: body.orden, activo: true, NOT: { id: preguntaId } },
    });
    if (existe) throw new BadRequestException(`Ya existe una pregunta con orden ${body.orden} en este paso`);
    return this.prisma.preguntaPlantilla.update({
      where: { id: preguntaId },
      data: {
        orden: body.orden,
        enunciado: body.enunciado,
        permitirArchivo: body.permitirArchivo ?? false,
        soloArchivo: body.soloArchivo ?? false,
        subirArchivoS3: body.subirArchivoS3 ?? false,
        usarIa: body.usarIa ?? false,
        iaAutomatica: (body.usarIa ?? false) ? (body.iaAutomatica ?? false) : false,
        promptIa: body.promptIa ?? null,
        urlPlantilla: body.urlPlantilla ?? null,
        urlPromptTemplate: body.urlPromptTemplate ?? null,
      },
    });
  }

  @Delete(':pasoId/preguntas/:preguntaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePregunta(@Param('pasoId') pasoId: string, @Param('preguntaId') preguntaId: string) {
    const count = await this.prisma.preguntaPlantilla.count({ where: { pasoId, activo: true } });
    if (count <= 1) throw new BadRequestException('Un paso debe tener al menos una pregunta');
    await this.prisma.preguntaPlantilla.update({ where: { id: preguntaId }, data: { activo: false } });
  }
}
