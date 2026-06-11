import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';
import { S3Service } from '../../storage/S3Service';
import { AppError } from '../../../shared/errors/AppError';
import { TranslationService } from '../../translation/translation.service';
import { TRANSLATABLE_LOCALES, PASO_TRANS_FIELDS, PREGUNTA_TRANS_FIELDS } from '../../../shared/i18n/translatable-locales';

@Controller('admin/plantillas/:plantillaId/pasos')
export class AdminPlantillaPasosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly translations: TranslationService,
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
    if (!plantilla) throw new AppError('PLANTILLA_NOT_FOUND');

    const pasoIds = plantilla.pasos.map(p => p.id);
    const preguntaIds = plantilla.pasos.flatMap(p => p.preguntas.map(q => q.id));
    const [pasoTrans, preguntaTrans] = await Promise.all([
      this.translations.applyOverlayMultiLocale('PasoPlantilla', pasoIds, TRANSLATABLE_LOCALES, PASO_TRANS_FIELDS),
      this.translations.applyOverlayMultiLocale('PreguntaPlantilla', preguntaIds, TRANSLATABLE_LOCALES, PREGUNTA_TRANS_FIELDS),
    ]);

    const pasosConTraducciones = plantilla.pasos.map(p => ({
      ...p,
      translations: pasoTrans[p.id] ?? {},
      preguntas: p.preguntas.map(q => ({
        ...q,
        translations: preguntaTrans[q.id] ?? {},
      })),
    }));

    return { nombre: plantilla.nombre, pasos: pasosConTraducciones };
  }

  @Post()
  async create(
    @Param('plantillaId') plantillaId: string,
    @Body() body: { titulo: string; objetivo?: string; instrucciones?: string; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; orden: number; permitirArchivo?: boolean; soloArchivo?: boolean; urlPlantilla?: string; translations?: Record<string, Record<string, string>> },
  ) {
    const plantilla = await this.prisma.plantillaActividad.findUnique({ where: { id: plantillaId, activo: true } });
    if (!plantilla) throw new AppError('PLANTILLA_NOT_FOUND');

    const existe = await this.prisma.pasoPlantilla.findFirst({
      where: { plantillaId, orden: body.orden, activo: true },
    });
    if (existe) throw new AppError('VALIDATION_ERROR', { message: `Ya existe un paso con orden ${body.orden} en esta plantilla` });

    const paso = await this.prisma.pasoPlantilla.create({
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

    if (body.translations) {
      await this.translations.upsertAllLocales('PasoPlantilla', paso.id, body.translations);
    }
    return paso;
  }

  @Put(':pasoId')
  async update(
    @Param('plantillaId') plantillaId: string,
    @Param('pasoId') pasoId: string,
    @Body() body: { titulo: string; objetivo?: string; instrucciones?: string; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; orden: number; permitirArchivo?: boolean; soloArchivo?: boolean; urlPlantilla?: string; translations?: Record<string, Record<string, string>> },
  ) {
    const existe = await this.prisma.pasoPlantilla.findFirst({
      where: { plantillaId, orden: body.orden, activo: true, NOT: { id: pasoId } },
    });
    if (existe) throw new AppError('VALIDATION_ERROR', { message: `Ya existe un paso con orden ${body.orden} en esta plantilla` });

    const paso = await this.prisma.pasoPlantilla.update({
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

    if (body.translations !== undefined) {
      await this.translations.upsertAllLocales('PasoPlantilla', pasoId, body.translations);
    }
    return paso;
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
    if (!paso) throw new AppError('PASO_NOT_FOUND');
    return paso.preguntas;
  }

  @Post(':pasoId/preguntas')
  async createPregunta(
    @Param('pasoId') pasoId: string,
    @Body() body: { orden: number; enunciado: string; permitirArchivo?: boolean; soloArchivo?: boolean; subirArchivoS3?: boolean; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; urlPlantilla?: string; urlPromptTemplate?: string; translations?: Record<string, Record<string, string>> },
  ) {
    const paso = await this.prisma.pasoPlantilla.findUnique({ where: { id: pasoId } });
    if (!paso) throw new AppError('PASO_NOT_FOUND');
    const existe = await this.prisma.preguntaPlantilla.findFirst({ where: { pasoId, orden: body.orden, activo: true } });
    if (existe) throw new AppError('VALIDATION_ERROR', { message: `Ya existe una pregunta con orden ${body.orden} en este paso` });

    const pregunta = await this.prisma.preguntaPlantilla.create({
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

    if (body.translations) {
      await this.translations.upsertAllLocales('PreguntaPlantilla', pregunta.id, body.translations);
    }
    return pregunta;
  }

  @Put(':pasoId/preguntas/:preguntaId')
  async updatePregunta(
    @Param('pasoId') pasoId: string,
    @Param('preguntaId') preguntaId: string,
    @Body() body: { orden: number; enunciado: string; permitirArchivo?: boolean; soloArchivo?: boolean; subirArchivoS3?: boolean; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; urlPlantilla?: string; urlPromptTemplate?: string; translations?: Record<string, Record<string, string>> },
  ) {
    const existe = await this.prisma.preguntaPlantilla.findFirst({
      where: { pasoId, orden: body.orden, activo: true, NOT: { id: preguntaId } },
    });
    if (existe) throw new AppError('VALIDATION_ERROR', { message: `Ya existe una pregunta con orden ${body.orden} en este paso` });

    const pregunta = await this.prisma.preguntaPlantilla.update({
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

    if (body.translations !== undefined) {
      await this.translations.upsertAllLocales('PreguntaPlantilla', preguntaId, body.translations);
    }
    return pregunta;
  }

  @Delete(':pasoId/preguntas/:preguntaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePregunta(@Param('pasoId') pasoId: string, @Param('preguntaId') preguntaId: string) {
    const count = await this.prisma.preguntaPlantilla.count({ where: { pasoId, activo: true } });
    if (count <= 1) throw new AppError('VALIDATION_ERROR', { message: 'Un paso debe tener al menos una pregunta' });
    await this.prisma.preguntaPlantilla.update({ where: { id: preguntaId }, data: { activo: false } });
  }

  // ── Prompt template (S3) por pregunta ────────────────────────────────────────

  /** Presigned PUT URL para subir el .md de prompt de una pregunta */
  @Post(':pasoId/preguntas/:preguntaId/presign-prompt')
  @HttpCode(HttpStatus.OK)
  async presignPrompt(
    @Param('preguntaId') preguntaId: string,
    @Body() body: { filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');
    const pregunta = await this.prisma.preguntaPlantilla.findUnique({
      where: { id: preguntaId },
      include: { paso: { include: { plantilla: true } } },
    });
    if (!pregunta) throw new AppError('PREGUNTA_NOT_FOUND');

    const prefix = `plantillas/${pregunta.paso.plantilla.id}/paso_${pregunta.paso.orden}/pregunta_${pregunta.orden}/prompt`;
    const key = this.s3.generateKey(prefix, body.filename);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, body.contentType);
    return { uploadUrl, key };
  }

  /** Graba el valor de urlPromptTemplate en BD (key S3 o path /templates/...) */
  @Patch(':pasoId/preguntas/:preguntaId/prompt-template')
  @HttpCode(HttpStatus.OK)
  async setPromptTemplate(
    @Param('preguntaId') preguntaId: string,
    @Body() body: { urlPromptTemplate: string },
  ): Promise<{ urlPromptTemplate: string | null }> {
    const pregunta = await this.prisma.preguntaPlantilla.findUnique({ where: { id: preguntaId } });
    if (!pregunta) throw new AppError('PREGUNTA_NOT_FOUND');
    const anterior = pregunta.urlPromptTemplate;
    const nuevo = body.urlPromptTemplate || null;
    await this.prisma.preguntaPlantilla.update({
      where: { id: preguntaId },
      data: { urlPromptTemplate: nuevo },
    });
    // Si la key anterior era S3 y cambió, borrar el objeto huérfano
    if (anterior && !anterior.startsWith('/') && anterior !== nuevo) {
      try { await this.s3.deleteObject(anterior); } catch (err) {
        console.error(`[AdminPlantillaPasosController] Error eliminando prompt anterior ${anterior}:`, err);
      }
    }
    return { urlPromptTemplate: nuevo };
  }

  /** Elimina el prompt template (S3 + BD) */
  @Delete(':pasoId/preguntas/:preguntaId/prompt-template')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePromptTemplate(@Param('preguntaId') preguntaId: string): Promise<void> {
    const pregunta = await this.prisma.preguntaPlantilla.findUnique({ where: { id: preguntaId } });
    if (!pregunta) throw new AppError('PREGUNTA_NOT_FOUND');
    const key = pregunta.urlPromptTemplate;
    await this.prisma.preguntaPlantilla.update({ where: { id: preguntaId }, data: { urlPromptTemplate: null } });
    if (key && !key.startsWith('/')) {
      try { await this.s3.deleteObject(key); } catch (err) {
        console.error(`[AdminPlantillaPasosController] Error eliminando prompt ${key}:`, err);
      }
    }
  }

  /** Presigned GET URL para descargar/previsualizar el prompt (admin) */
  @Get(':pasoId/preguntas/:preguntaId/prompt-url')
  async promptUrl(@Param('preguntaId') preguntaId: string): Promise<{ url: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');
    const pregunta = await this.prisma.preguntaPlantilla.findUnique({ where: { id: preguntaId } });
    if (!pregunta?.urlPromptTemplate || pregunta.urlPromptTemplate.startsWith('/')) {
      throw new AppError('PREGUNTA_NOT_FOUND', { message: 'La pregunta no tiene prompt en S3' });
    }
    const url = await this.s3.getPresignedGetUrl(pregunta.urlPromptTemplate);
    return { url };
  }

  // ── Traducciones por paso/pregunta ───────────────────────────────────────

  @Get(':pasoId/translations')
  async getPasoTranslations(
    @Param('pasoId') pasoId: string,
    @Query('locale') locale: string = 'pt',
  ): Promise<Record<string, string>> {
    return this.translations.getForEntity('PasoPlantilla', pasoId, locale);
  }

  @Put(':pasoId/translations/:locale')
  @HttpCode(HttpStatus.OK)
  async putPasoTranslations(
    @Param('pasoId') pasoId: string,
    @Param('locale') locale: string,
    @Body() body: Record<string, string>,
  ): Promise<{ ok: boolean }> {
    await this.translations.upsertForEntity('PasoPlantilla', pasoId, locale, body);
    return { ok: true };
  }

  @Get(':pasoId/preguntas/:preguntaId/translations')
  async getPreguntaTranslations(
    @Param('preguntaId') preguntaId: string,
    @Query('locale') locale: string = 'pt',
  ): Promise<Record<string, string>> {
    return this.translations.getForEntity('PreguntaPlantilla', preguntaId, locale);
  }

  @Put(':pasoId/preguntas/:preguntaId/translations/:locale')
  @HttpCode(HttpStatus.OK)
  async putPreguntaTranslations(
    @Param('preguntaId') preguntaId: string,
    @Param('locale') locale: string,
    @Body() body: Record<string, string>,
  ): Promise<{ ok: boolean }> {
    await this.translations.upsertForEntity('PreguntaPlantilla', preguntaId, locale, body);
    return { ok: true };
  }
}
