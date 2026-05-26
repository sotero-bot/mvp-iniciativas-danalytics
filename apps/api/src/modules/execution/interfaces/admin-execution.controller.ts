import { Controller, Get, Post, Delete, Body, Param, NotFoundException, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { parseTableFromContent } from '../../../shared/utils/parseTableFromContent';
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
          where: { archivoNombre: { not: null } },
          select: { pasoId: true, archivoNombre: true },
        },
      },
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

  @Get(':id/excel/:pasoId')
  async descargarExcelPaso(
    @Param('id') id: string,
    @Param('pasoId') pasoId: string,
    @Res() res: Response,
  ) {
    const interaccion = await this.prisma.interaccion.findFirst({
      where: { instanciaId: id, pasoId },
      select: { contenido: true, archivoNombre: true },
    });
    if (!interaccion?.contenido) throw new NotFoundException('Sin datos para este paso');

    const filas = parseTableFromContent(interaccion.contenido);
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

    const nombre = interaccion.archivoNombre || 'priorizacion.xlsx';
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
