import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';

@Controller('admin/plantillas')
export class AdminPlantillasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    return this.prisma.plantillaActividad.findMany({
      where: { activo: true },
      include: { _count: { select: { pasos: { where: { activo: true } } } } },
      orderBy: [{ orden: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; descripcion?: string; orden?: number }) {
    return this.prisma.plantillaActividad.create({
      data: { nombre: body.nombre, descripcion: body.descripcion, orden: body.orden ?? null },
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { nombre: string; descripcion?: string; orden?: number | null },
  ) {
    const exists = await this.prisma.plantillaActividad.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Plantilla no encontrada');
    return this.prisma.plantillaActividad.update({
      where: { id },
      data: { nombre: body.nombre, descripcion: body.descripcion, orden: body.orden ?? null },
    });
  }

  @Post('import')
  async importPlantillas(@Body() body: { plantillas: { nombre: string; descripcion?: string; orden?: number; pasos?: { titulo: string; objetivo?: string; instrucciones?: string; usarIa?: boolean; promptIa?: string; permitirArchivo?: boolean; urlPlantilla?: string }[] }[] }) {
    if (!Array.isArray(body.plantillas) || body.plantillas.length === 0) {
      throw new BadRequestException('El JSON debe contener al menos una plantilla');
    }

    const result = { plantillasCreadas: 0, pasosCreados: 0, details: [] as any[] };

    await this.prisma.$transaction(async (tx) => {
      for (const item of body.plantillas) {
        if (!item.nombre?.trim()) continue;

        const plantilla = await tx.plantillaActividad.create({
          data: {
            nombre: item.nombre.trim(),
            descripcion: item.descripcion?.trim() ?? null,
            orden: item.orden ?? null,
          },
        });
        result.plantillasCreadas++;

        const pasos = item.pasos ?? [];
        if (pasos.length > 0) {
          await tx.pasoPlantilla.createMany({
            data: pasos.map((p, idx) => ({
              id: randomUUID(),
              plantillaId: plantilla.id,
              titulo: p.titulo.trim(),
              objetivo: p.objetivo?.trim() ?? null,
              instrucciones: p.instrucciones?.trim() ?? null,
              usarIa: p.usarIa ?? false,
              promptIa: p.promptIa?.trim() ?? null,
              permitirArchivo: p.permitirArchivo ?? false,
              urlPlantilla: p.urlPlantilla?.trim() ?? null,
              orden: idx + 1,
            })),
          });
          result.pasosCreados += pasos.length;
        }

        result.details.push({ nombre: plantilla.nombre, orden: plantilla.orden, pasos: pasos.length });
      }
    });

    return result;
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
