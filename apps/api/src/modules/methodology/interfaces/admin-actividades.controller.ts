import { Controller, Post, Put, Patch, Delete, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';
import { AgregarPasoActividadUseCase } from '../application/AgregarPasoActividadUseCase';
import { ObtenerPasosActividadUseCase } from '../application/ObtenerPasosActividadUseCase';
import { AgregarPasoDto } from './dtos/agregar-paso.dto';
import { PasoActividadResponseDto } from './dtos/paso-actividad-response.dto';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';
import { S3Service } from '../../storage/S3Service';
import { AppError } from '../../../shared/errors/AppError';

@Controller('admin/actividades')
export class AdminActividadesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agregarPasoUseCase: AgregarPasoActividadUseCase,
    private readonly obtenerPasosUseCase: ObtenerPasosActividadUseCase,
    private readonly s3: S3Service,
  ) { }

  @Get(':id/pasos')
  async obtenerPasos(@Param('id') id: string) {
    try {
      const actividad = await this.prisma.actividad.findUnique({
        where: { id },
        include: {
          pasos: {
            where: { activo: true },
            orderBy: { orden: 'asc' },
            include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
          },
        },
      });
      if (!actividad) throw new AppError('ACTIVIDAD_NOT_FOUND');
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
          iaAutomatica: p.iaAutomatica ?? false,
          promptIa: p.promptIa,
          permitirArchivo: p.permitirArchivo ?? false,
          soloArchivo: p.soloArchivo ?? false,
          urlPlantilla: p.urlPlantilla || undefined,
          ejemploKey: (p as any).ejemploKey || undefined,
          preguntas: (p as any).preguntas ?? [],
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
      throw new AppError('ACTIVIDAD_NOT_FOUND', { message: error.message });
    }
    if (error instanceof BusinessRuleViolationError) {
      throw new AppError('VALIDATION_ERROR', { message: error.message });
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
      const data: any = {};
      if (dto.titulo !== undefined) data.titulo = dto.titulo;
      if (dto.objetivo !== undefined) data.objetivo = dto.objetivo;
      if (dto.instrucciones !== undefined) data.instrucciones = dto.instrucciones;
      if (dto.orden !== undefined) data.orden = dto.orden;
      if (dto.usarIa !== undefined) {
        data.usarIa = !!dto.usarIa;
        data.iaAutomatica = dto.usarIa ? (dto.iaAutomatica ?? false) : false;
      }
      if (dto.promptIa !== undefined) data.promptIa = dto.promptIa;
      if (dto.permitirArchivo !== undefined) data.permitirArchivo = !!dto.permitirArchivo;
      if (dto.soloArchivo !== undefined) data.soloArchivo = !!dto.soloArchivo;
      if (dto.urlPlantilla !== undefined) data.urlPlantilla = dto.urlPlantilla ?? null;
      if (dto.ejemploKey !== undefined) data.ejemploKey = dto.ejemploKey;

      return await this.prisma.pasoActividad.update({ where: { id: pasoId }, data });
    } catch (error) {
      console.error(`[AdminActividadesController] ERROR UPDATING PASO:`, error);
      throw error;
    }
  }

  /** Presigned PUT URL para subida directa del archivo de ejemplo del paso */
  @Post(':id/pasos/:pasoId/presign-ejemplo')
  @HttpCode(HttpStatus.OK)
  async presignEjemplo(
    @Param('pasoId') pasoId: string,
    @Body() body: { filename: string; contentType: string }
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');

    const paso = await this.prisma.pasoActividad.findUnique({
      where: { id: pasoId },
      include: {
        actividad: {
          include: {
            iniciativa: {
              include: { empresa: true },
            },
          },
        },
      },
    });
    if (!paso) throw new AppError('PASO_NOT_FOUND');

    const empresa = S3Service.slugifyPathSegment(paso.actividad.iniciativa.empresa.nombre) || 'empresa';
    const actividad = S3Service.slugifyPathSegment(paso.actividad.nombre) || 'actividad';
    const prefix = `${empresa}/${actividad}/paso_${paso.orden}/ejemplo`;

    const key = this.s3.generateKey(prefix, body.filename);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, body.contentType);
    return { uploadUrl, key };
  }

  /** Presigned GET URL para descargar el archivo de ejemplo del paso */
  @Get(':id/pasos/:pasoId/ejemplo-url')
  async ejemploUrl(@Param('pasoId') pasoId: string): Promise<{ url: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');
    const paso = await this.prisma.pasoActividad.findUnique({ where: { id: pasoId } });
    if (!paso?.ejemploKey) throw new AppError('ARCHIVO_INVALID', { message: 'Archivo de ejemplo no encontrado' });
    const url = await this.s3.getPresignedGetUrl(paso.ejemploKey);
    return { url };
  }

  /** Elimina el archivo de ejemplo del paso (S3 + BD) */
  @Delete(':id/pasos/:pasoId/ejemplo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarEjemplo(@Param('pasoId') pasoId: string): Promise<void> {
    const paso = await this.prisma.pasoActividad.findUnique({ where: { id: pasoId } });
    if (!paso) throw new AppError('PASO_NOT_FOUND');
    if (!paso.ejemploKey) return;
    const key = paso.ejemploKey;
    await this.prisma.pasoActividad.update({ where: { id: pasoId }, data: { ejemploKey: null } });
    try {
      await this.s3.deleteObject(key);
    } catch (err) {
      console.error(`[AdminActividadesController] Error eliminando objeto S3 ${key}:`, err);
    }
  }

  // ── Preguntas ────────────────────────────────────────────────────────────────

  @Get(':id/pasos/:pasoId/preguntas')
  async findPreguntas(@Param('pasoId') pasoId: string) {
    const paso = await this.prisma.pasoActividad.findUnique({
      where: { id: pasoId },
      include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
    });
    if (!paso) throw new AppError('PASO_NOT_FOUND');
    return paso.preguntas;
  }

  @Post(':id/pasos/:pasoId/preguntas')
  async createPregunta(
    @Param('pasoId') pasoId: string,
    @Body() body: { orden: number; enunciado: string; permitirArchivo?: boolean; soloArchivo?: boolean; subirArchivoS3?: boolean; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; urlPlantilla?: string; urlPromptTemplate?: string },
  ) {
    const paso = await this.prisma.pasoActividad.findUnique({ where: { id: pasoId } });
    if (!paso) throw new AppError('PASO_NOT_FOUND');
    const existe = await this.prisma.preguntaActividad.findFirst({ where: { pasoId, orden: body.orden, activo: true } });
    if (existe) throw new AppError('VALIDATION_ERROR', { message: `Ya existe una pregunta con orden ${body.orden} en este paso` });
    return this.prisma.preguntaActividad.create({
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

  @Put(':id/pasos/:pasoId/preguntas/:preguntaId')
  async updatePregunta(
    @Param('pasoId') pasoId: string,
    @Param('preguntaId') preguntaId: string,
    @Body() body: { orden: number; enunciado: string; permitirArchivo?: boolean; soloArchivo?: boolean; subirArchivoS3?: boolean; usarIa?: boolean; iaAutomatica?: boolean; promptIa?: string; urlPlantilla?: string; urlPromptTemplate?: string },
  ) {
    const existe = await this.prisma.preguntaActividad.findFirst({
      where: { pasoId, orden: body.orden, activo: true, NOT: { id: preguntaId } },
    });
    if (existe) throw new AppError('VALIDATION_ERROR', { message: `Ya existe una pregunta con orden ${body.orden} en este paso` });
    return this.prisma.preguntaActividad.update({
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

  @Delete(':id/pasos/:pasoId/preguntas/:preguntaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePregunta(@Param('pasoId') pasoId: string, @Param('preguntaId') preguntaId: string) {
    const count = await this.prisma.preguntaActividad.count({ where: { pasoId, activo: true } });
    if (count <= 1) throw new AppError('VALIDATION_ERROR', { message: 'Un paso debe tener al menos una pregunta' });
    await this.prisma.preguntaActividad.update({ where: { id: preguntaId }, data: { activo: false } });
  }

  // ── Prompt template (S3) por pregunta ────────────────────────────────────────

  /** Presigned PUT URL para subir el .md de prompt de una pregunta */
  @Post(':id/pasos/:pasoId/preguntas/:preguntaId/presign-prompt')
  @HttpCode(HttpStatus.OK)
  async presignPrompt(
    @Param('preguntaId') preguntaId: string,
    @Body() body: { filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');
    const pregunta = await this.prisma.preguntaActividad.findUnique({
      where: { id: preguntaId },
      include: {
        paso: {
          include: {
            actividad: {
              include: { iniciativa: { include: { empresa: true } } },
            },
          },
        },
      },
    });
    if (!pregunta) throw new AppError('PREGUNTA_NOT_FOUND');

    const empresa = S3Service.slugifyPathSegment(pregunta.paso.actividad.iniciativa.empresa.nombre) || 'empresa';
    const actividad = S3Service.slugifyPathSegment(pregunta.paso.actividad.nombre) || 'actividad';
    const prefix = `${empresa}/${actividad}/paso_${pregunta.paso.orden}/pregunta_${pregunta.orden}/prompt`;
    const key = this.s3.generateKey(prefix, body.filename);
    const uploadUrl = await this.s3.getPresignedPutUrl(key, body.contentType);
    return { uploadUrl, key };
  }

  /** Graba el valor de urlPromptTemplate en BD (key S3 o path /templates/...) */
  @Patch(':id/pasos/:pasoId/preguntas/:preguntaId/prompt-template')
  @HttpCode(HttpStatus.OK)
  async setPromptTemplate(
    @Param('preguntaId') preguntaId: string,
    @Body() body: { urlPromptTemplate: string },
  ): Promise<{ urlPromptTemplate: string | null }> {
    const pregunta = await this.prisma.preguntaActividad.findUnique({ where: { id: preguntaId } });
    if (!pregunta) throw new AppError('PREGUNTA_NOT_FOUND');
    const anterior = pregunta.urlPromptTemplate;
    const nuevo = body.urlPromptTemplate || null;
    await this.prisma.preguntaActividad.update({
      where: { id: preguntaId },
      data: { urlPromptTemplate: nuevo },
    });
    if (anterior && !anterior.startsWith('/') && anterior !== nuevo) {
      try { await this.s3.deleteObject(anterior); } catch (err) {
        console.error(`[AdminActividadesController] Error eliminando prompt anterior ${anterior}:`, err);
      }
    }
    return { urlPromptTemplate: nuevo };
  }

  /** Elimina el prompt template (S3 + BD) */
  @Delete(':id/pasos/:pasoId/preguntas/:preguntaId/prompt-template')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePromptTemplate(@Param('preguntaId') preguntaId: string): Promise<void> {
    const pregunta = await this.prisma.preguntaActividad.findUnique({ where: { id: preguntaId } });
    if (!pregunta) throw new AppError('PREGUNTA_NOT_FOUND');
    const key = pregunta.urlPromptTemplate;
    await this.prisma.preguntaActividad.update({ where: { id: preguntaId }, data: { urlPromptTemplate: null } });
    if (key && !key.startsWith('/')) {
      try { await this.s3.deleteObject(key); } catch (err) {
        console.error(`[AdminActividadesController] Error eliminando prompt ${key}:`, err);
      }
    }
  }

  /** Presigned GET URL para descargar/previsualizar el prompt (admin) */
  @Get(':id/pasos/:pasoId/preguntas/:preguntaId/prompt-url')
  async promptUrl(@Param('preguntaId') preguntaId: string): Promise<{ url: string }> {
    if (!this.s3.isConfigured) throw new AppError('S3_NOT_CONFIGURED');
    const pregunta = await this.prisma.preguntaActividad.findUnique({ where: { id: preguntaId } });
    if (!pregunta?.urlPromptTemplate || pregunta.urlPromptTemplate.startsWith('/')) {
      throw new AppError('PREGUNTA_NOT_FOUND', { message: 'La pregunta no tiene prompt en S3' });
    }
    const url = await this.s3.getPresignedGetUrl(pregunta.urlPromptTemplate);
    return { url };
  }
}
