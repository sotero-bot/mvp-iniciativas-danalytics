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
  async importPlantillas(@Body() body: {
    plantillas: {
      nombre: string;
      descripcion?: string;
      orden?: number;
      pasos?: {
        titulo: string;
        objetivo?: string;
        instrucciones?: string;
        ejemplo?: string | null;
        // Campos legacy a nivel paso (formato JSON antiguo, conservados por compat)
        usarIa?: boolean;
        iaAutomatica?: boolean;
        promptIa?: string;
        permitirArchivo?: boolean;
        soloArchivo?: boolean;
        urlPlantilla?: string;
        // Formato nuevo: arreglo de preguntas
        preguntas?: {
          orden?: number;
          enunciado: string;
          permitirArchivo?: boolean;
          soloArchivo?: boolean;
          subirArchivoS3?: boolean;
          usarIa?: boolean;
          iaAutomatica?: boolean;
          promptIa?: string | null;
          urlPlantilla?: string | null;
          urlPromptTemplate?: string | null;
        }[];
      }[];
    }[];
  }) {
    if (!Array.isArray(body.plantillas) || body.plantillas.length === 0) {
      throw new BadRequestException('El JSON debe contener al menos una plantilla');
    }

    const result = { plantillasCreadas: 0, pasosCreados: 0, preguntasCreadas: 0, details: [] as any[] };

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
        let preguntasCreadasPaso = 0;

        for (let idx = 0; idx < pasos.length; idx++) {
          const p = pasos[idx];

          // Bridge de compatibilidad: si el JSON trae el formato antiguo (flags
          // a nivel paso) y no trae preguntas, sintetizamos una pregunta única
          // que las transporte, para mantener la nueva estructura.
          const preguntasInput = (p.preguntas && p.preguntas.length > 0)
            ? p.preguntas
            : [{
                orden: 1,
                enunciado: p.objetivo?.trim() || p.titulo.trim(),
                permitirArchivo: p.permitirArchivo,
                soloArchivo: p.soloArchivo,
                usarIa: p.usarIa,
                iaAutomatica: p.iaAutomatica,
                promptIa: p.promptIa,
                urlPlantilla: p.urlPlantilla,
              }];

          // Agregar flags de las preguntas al paso para mantener el runner actual
          // funcionando (legacy compat). Cuando el runner pase a leer por
          // pregunta (REQ-07), este bridge desaparece.
          const aggUsarIa = preguntasInput.some(q => !!q.usarIa);
          const aggIaAutomatica = aggUsarIa && preguntasInput.some(q => !!q.iaAutomatica);
          const aggPermitirArchivo = preguntasInput.some(q => !!q.permitirArchivo);
          const aggSoloArchivo = preguntasInput.some(q => !!q.soloArchivo);
          const aggPromptIa = preguntasInput.find(q => q.promptIa?.toString().trim())?.promptIa?.toString().trim() ?? null;
          const aggUrlPlantilla = preguntasInput.find(q => q.urlPlantilla?.toString().trim())?.urlPlantilla?.toString().trim() ?? null;

          const pasoId = randomUUID();
          await tx.pasoPlantilla.create({
            data: {
              id: pasoId,
              plantillaId: plantilla.id,
              titulo: p.titulo.trim(),
              objetivo: p.objetivo?.trim() ?? null,
              instrucciones: p.instrucciones?.trim() ?? null,
              usarIa: aggUsarIa,
              iaAutomatica: aggIaAutomatica,
              promptIa: aggPromptIa,
              permitirArchivo: aggPermitirArchivo,
              soloArchivo: aggSoloArchivo,
              urlPlantilla: aggUrlPlantilla,
              ejemploKey: p.ejemplo?.trim() || null,
              orden: idx + 1,
            },
          });
          result.pasosCreados++;

          await tx.preguntaPlantilla.createMany({
            data: preguntasInput.map((q, qIdx) => ({
              id: randomUUID(),
              pasoId,
              orden: q.orden ?? (qIdx + 1),
              enunciado: q.enunciado?.trim() ?? '',
              permitirArchivo: q.permitirArchivo ?? false,
              soloArchivo: q.soloArchivo ?? false,
              subirArchivoS3: q.subirArchivoS3 ?? false,
              usarIa: q.usarIa ?? false,
              iaAutomatica: (q.usarIa ?? false) ? (q.iaAutomatica ?? false) : false,
              promptIa: q.promptIa?.toString().trim() || null,
              urlPlantilla: q.urlPlantilla?.toString().trim() || null,
              urlPromptTemplate: q.urlPromptTemplate?.toString().trim() || null,
            })),
          });
          preguntasCreadasPaso += preguntasInput.length;
        }

        result.preguntasCreadas += preguntasCreadasPaso;
        result.details.push({ nombre: plantilla.nombre, orden: plantilla.orden, pasos: pasos.length, preguntas: preguntasCreadasPaso });
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
