import { Controller, Get, Post, Delete, Body, Param, NotFoundException, BadRequestException, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { parseTableFromContent } from '../../../shared/utils/parseTableFromContent';
import { GenerarInstanciaUseCase } from '../application/GenerarInstanciaUseCase';
import { ObtenerInstanciaDetalleUseCase } from '../application/ObtenerInstanciaDetalleUseCase';
import { PrismaService } from '../../../prisma.service';
import { S3Service } from '../../storage/S3Service';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

@Controller('admin/instancias')
export class AdminExecutionController {
  constructor(
    private readonly generarUseCase: GenerarInstanciaUseCase,
    private readonly obtenerDetalleUseCase: ObtenerInstanciaDetalleUseCase,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) { }

  @Post('generar')
  async generar(@Body() body: { actividadId: string; emailReferencia?: string }) {
    const result = await this.generarUseCase.execute(body.actividadId, body.emailReferencia);
    return { id: result.id, accessToken: result.accessToken };
  }

  @Get()
  async listAll() {
    return this.prisma.instanciaActividad.findMany({
      where: { activo: true },
      orderBy: { createdAt: 'desc' },
      include: {
        actividad: {
          include: {
            iniciativa: { include: { empresa: true } },
            plantillaOrigen: { select: { id: true, nombre: true } },
          },
        },
        usuario: true,
        interacciones: {
          select: { pasoId: true, archivoNombre: true, paso: { select: { titulo: true } } },
        },
        respuestas: {
          where: { archivoNombre: { not: null } },
          select: {
            preguntaId: true,
            archivoNombre: true,
            archivoKey: true,
            pregunta: {
              select: {
                orden: true,
                paso: { select: { titulo: true, orden: true } },
              },
            },
          },
        },
      },
    });
  }

  /** Presigned GET URL para descargar el archivo original subido como respuesta */
  @Get(':id/respuestas/:preguntaId/archivo-url')
  async respuestaArchivoUrl(
    @Param('id') instanciaId: string,
    @Param('preguntaId') preguntaId: string,
  ): Promise<{ url: string; archivoNombre: string }> {
    if (!this.s3.isConfigured) throw new BadRequestException('S3 no configurado');
    const respuesta = await this.prisma.respuesta.findUnique({
      where: { instanciaId_preguntaId: { instanciaId, preguntaId } },
      select: {
        archivoKey: true,
        archivoNombre: true,
        instancia: {
          select: {
            usuario: { select: { area: true } },
            actividad: {
              select: {
                nombre: true,
                plantillaOrigen: { select: { nombre: true } },
                iniciativa: { select: { empresa: { select: { nombre: true } } } },
              },
            },
          },
        },
      },
    });
    if (!respuesta?.archivoKey) throw new NotFoundException('Archivo no encontrado para esta respuesta');

    // Nombre amigable: <empresa>_<plantilla|actividad>_<area>.xlsx (preserva caso, slugifica el resto)
    const slug = (s: string) => (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const ext = (respuesta.archivoNombre?.match(/\.[a-z0-9]+$/i)?.[0]) || '.xlsx';
    const plantillaOActividadNombre =
      respuesta.instancia?.actividad?.plantillaOrigen?.nombre || respuesta.instancia?.actividad?.nombre || '';
    const downloadName = [
      slug(respuesta.instancia?.actividad?.iniciativa?.empresa?.nombre || ''),
      slug(plantillaOActividadNombre),
      slug(respuesta.instancia?.usuario?.area || ''),
    ].filter(Boolean).join('_') + ext;

    const url = await this.s3.getPresignedGetUrl(respuesta.archivoKey, 3600, downloadName);
    return { url, archivoNombre: downloadName };
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

  @Get(':id/excel/:pasoId')
  async descargarExcelPaso(
    @Param('id') id: string,
    @Param('pasoId') pasoId: string,
    @Res() res: Response,
  ) {
    const interaccion = await this.prisma.interaccion.findFirst({
      where: { instanciaId: id, pasoId },
      select: {
        contenido: true,
        archivoNombre: true,
        contenidoArchivo: true,
        instancia: {
          select: {
            actividad: {
              select: {
                nombre: true,
                iniciativa: { select: { empresa: { select: { nombre: true } } } },
              },
            },
            usuario: { select: { area: true } },
          },
        },
        paso: { select: { titulo: true } },
      },
    });
    if (!interaccion?.contenido && !interaccion?.contenidoArchivo) throw new NotFoundException('Sin datos para este paso');

    // Preferir contenidoArchivo (campo dedicado para el Excel subido por el usuario).
    // Fallback al workaround anterior: split del contenido por separador.
    let contenidoArchivo: string;
    if (interaccion.contenidoArchivo) {
      contenidoArchivo = interaccion.contenidoArchivo;
    } else {
      const secciones = interaccion.contenido!.split('\n\n---\n\n');
      contenidoArchivo = secciones[secciones.length - 1];
    }

    // Si el Excel tiene múltiples hojas (ej. "### Priorización\n...\n### Criterios\n..."),
    // usar solo la primera sección para no mezclar datos del usuario con la hoja de criterios.
    const primeraSección = contenidoArchivo.split(/\n### /)[0];
    const filas = parseTableFromContent(primeraSección);
    if (filas.length === 0) throw new NotFoundException('No se encontró tabla en el contenido del paso');

    const headers = Object.keys(filas[0]);
    const TEXT_COLS = new Set(['Dolor identificado', 'Idea de Proyecto', '¿Qué permite o resuelve?', '¿Qué valor tendría?', 'Oportunidad de IA', 'Por qué ese tipo', 'Impacto potencial']);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Priorización');
    ws.columns = headers.map(h => ({ width: TEXT_COLS.has(h) ? 35 : 14 }));

    // Fila de encabezados
    const headerRow = ws.addRow(headers);
    headerRow.height = 22;
    for (let c = 1; c <= headers.length; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    }

    // Filas de datos
    for (const fila of filas) {
      const row = ws.addRow(headers.map(h => fila[h] ?? ''));
      row.height = 55;
      for (let c = 1; c <= headers.length; c++) {
        row.getCell(c).alignment = TEXT_COLS.has(headers[c - 1])
          ? { vertical: 'top', wrapText: true }
          : { vertical: 'middle', horizontal: 'center' };
      }
    }

    const slug = (s: string) => (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const empresa = slug(interaccion.instancia?.actividad?.iniciativa?.empresa?.nombre || '');
    const actividad = slug(interaccion.instancia?.actividad?.nombre || '');
    const area = slug(interaccion.instancia?.usuario?.area || '');
    const paso = slug(interaccion.paso?.titulo || '');
    const nombre = [empresa, actividad, area, paso].filter(Boolean).join('_') + '.xlsx';
    const buffer: Buffer = await wb.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    });
    res.send(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string) {
    await this.prisma.instanciaActividad.update({
      where: { id },
      data: { activo: false }
    });
  }
}
