import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AppError } from '../../shared/errors/AppError';

interface PreguntaInput { orden: number; enunciado?: string; promptIa?: string }
interface PasoInput { orden: number; titulo?: string; objetivo?: string; instrucciones?: string; promptIa?: string; preguntas?: PreguntaInput[] }
interface PlantillaInput { locale: string; nombre_original: string; nombre?: string; descripcion?: string; pasos?: PasoInput[] }

interface LoadResult {
  plantilla: string;
  locale: string;
  total: number;
  pasos: number;
  preguntas: number;
  warnings: string[];
}

@Controller('admin/translations')
export class TranslationController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('load-json')
  @HttpCode(HttpStatus.OK)
  async loadJson(@Body() body: { plantillas: PlantillaInput[] }): Promise<{ results: LoadResult[]; grandTotal: number }> {
    if (!Array.isArray(body?.plantillas) || body.plantillas.length === 0) {
      throw new AppError('VALIDATION_ERROR', { message: 'El body debe tener el campo "plantillas" como array.' });
    }

    const results: LoadResult[] = [];

    for (const input of body.plantillas) {
      const result: LoadResult = { plantilla: input.nombre_original ?? '?', locale: input.locale ?? '?', total: 0, pasos: 0, preguntas: 0, warnings: [] };

      if (!input.locale) { result.warnings.push('Falta campo "locale"'); results.push(result); continue; }
      if (!input.nombre_original) { result.warnings.push('Falta campo "nombre_original"'); results.push(result); continue; }

      const plantilla = await this.prisma.plantillaActividad.findFirst({
        where: { nombre: input.nombre_original, activo: true },
        include: {
          pasos: {
            where: { activo: true },
            orderBy: { orden: 'asc' },
            include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
          },
        },
      });

      if (!plantilla) {
        result.warnings.push(`Plantilla no encontrada: "${input.nombre_original}"`);
        results.push(result);
        continue;
      }

      // Traducción nombre/descripción de la plantilla
      for (const [field, value] of [['nombre', input.nombre], ['descripcion', input.descripcion]] as const) {
        if (value?.trim()) {
          await this.upsert('PlantillaActividad', plantilla.id, field, input.locale, value.trim());
          result.total++;
        }
      }

      const pasoMap = new Map(plantilla.pasos.map(p => [p.orden, p]));

      for (const pasoInput of input.pasos ?? []) {
        const paso = pasoMap.get(pasoInput.orden);
        if (!paso) { result.warnings.push(`Paso orden ${pasoInput.orden} no encontrado`); continue; }

        let pasoCount = 0;
        for (const [field, value] of [
          ['titulo', pasoInput.titulo],
          ['objetivo', pasoInput.objetivo],
          ['instrucciones', pasoInput.instrucciones],
          ['promptIa', pasoInput.promptIa],
        ] as const) {
          if (value?.trim()) {
            await this.upsert('PasoPlantilla', paso.id, field, input.locale, value.trim());
            pasoCount++;
          }
        }
        if (pasoCount > 0) result.pasos++;
        result.total += pasoCount;

        const preguntaMap = new Map(paso.preguntas.map(q => [q.orden, q]));

        for (const preguntaInput of pasoInput.preguntas ?? []) {
          const pregunta = preguntaMap.get(preguntaInput.orden);
          if (!pregunta) { result.warnings.push(`Pregunta orden ${preguntaInput.orden} (paso ${pasoInput.orden}) no encontrada`); continue; }

          let pregCount = 0;
          for (const [field, value] of [
            ['enunciado', preguntaInput.enunciado],
            ['promptIa', preguntaInput.promptIa],
          ] as const) {
            if (value?.trim()) {
              await this.upsert('PreguntaPlantilla', pregunta.id, field, input.locale, value.trim());
              pregCount++;
            }
          }
          if (pregCount > 0) result.preguntas++;
          result.total += pregCount;
        }
      }

      results.push(result);
    }

    const grandTotal = results.reduce((s, r) => s + r.total, 0);
    return { results, grandTotal };
  }

  private async upsert(entityType: string, entityId: string, field: string, locale: string, value: string) {
    await this.prisma.translation.upsert({
      where: { entityType_entityId_field_locale: { entityType, entityId, field, locale } },
      create: { entityType, entityId, field, locale, value },
      update: { value },
    });
  }
}
