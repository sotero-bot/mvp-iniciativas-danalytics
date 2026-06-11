import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';
import { AppError } from '../../../shared/errors/AppError';
import { TranslationService } from '../../translation/translation.service';

interface PreguntaTransInput { orden: number; enunciado?: string; promptIa?: string }
interface PasoTransInput { orden: number; titulo?: string; objetivo?: string; instrucciones?: string; promptIa?: string; preguntas?: PreguntaTransInput[] }
interface PlantillaTransInput { locale: string; nombre?: string; descripcion?: string; pasos?: PasoTransInput[] }

@Controller('admin/plantillas')
export class AdminPlantillasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translations: TranslationService,
  ) {}

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
    if (!exists) throw new AppError('PLANTILLA_NOT_FOUND');
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
      throw new AppError('IMPORT_INVALID_JSON', { message: 'El JSON debe contener al menos una plantilla' });
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

  @Post(':id/translations/load-json')
  @HttpCode(HttpStatus.OK)
  async loadTranslations(
    @Param('id') id: string,
    @Body() body: PlantillaTransInput,
  ): Promise<{ total: number; pasos: number; preguntas: number; warnings: string[] }> {
    if (!body?.locale) throw new AppError('VALIDATION_ERROR', { message: 'Falta campo "locale".' });

    const plantilla = await this.prisma.plantillaActividad.findUnique({
      where: { id, activo: true },
      include: {
        pasos: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
        },
      },
    });
    if (!plantilla) throw new AppError('PLANTILLA_NOT_FOUND');

    const warnings: string[] = [];
    let total = 0, pasosCount = 0, preguntasCount = 0;

    for (const [field, value] of [['nombre', body.nombre], ['descripcion', body.descripcion]] as const) {
      if (value?.trim()) {
        await this.translations.upsertForEntity('PlantillaActividad', id, body.locale, { [field]: value.trim() });
        total++;
      }
    }

    const pasoMap = new Map(plantilla.pasos.map(p => [p.orden, p]));

    for (const pasoInput of body.pasos ?? []) {
      const paso = pasoMap.get(pasoInput.orden);
      if (!paso) { warnings.push(`Paso orden ${pasoInput.orden} no encontrado`); continue; }

      const pasoFields: Record<string, string | undefined> = {
        titulo: pasoInput.titulo, objetivo: pasoInput.objetivo,
        instrucciones: pasoInput.instrucciones, promptIa: pasoInput.promptIa,
      };
      const pasoEntries = Object.entries(pasoFields).filter(([, v]) => v?.trim());
      if (pasoEntries.length > 0) {
        await this.translations.upsertForEntity('PasoPlantilla', paso.id, body.locale, Object.fromEntries(pasoEntries));
        total += pasoEntries.length;
        pasosCount++;
      }

      const preguntaMap = new Map(paso.preguntas.map(q => [q.orden, q]));
      for (const pregInput of pasoInput.preguntas ?? []) {
        const pregunta = preguntaMap.get(pregInput.orden);
        if (!pregunta) { warnings.push(`Pregunta orden ${pregInput.orden} (paso ${pasoInput.orden}) no encontrada`); continue; }

        const pregFields: Record<string, string | undefined> = {
          enunciado: pregInput.enunciado, promptIa: pregInput.promptIa,
        };
        const pregEntries = Object.entries(pregFields).filter(([, v]) => v?.trim());
        if (pregEntries.length > 0) {
          await this.translations.upsertForEntity('PreguntaPlantilla', pregunta.id, body.locale, Object.fromEntries(pregEntries));
          total += pregEntries.length;
          preguntasCount++;
        }
      }
    }

    return { total, pasos: pasosCount, preguntas: preguntasCount, warnings };
  }
}
