import { Controller, Get, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';
import { ResultadosService } from '../application/resultados.service';

// Autorización (Plan 2 §0.1, RF-34/RN-07): SOLO danalytics_admin ve individuales,
// comparativo inicial vs. final y exporta. Ningún otro rol recibe archivos.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminResultadosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resultados: ResultadosService,
  ) {}

  // RF-34: individual + comparativo. Con ?export=xlsx devuelve Excel (RN-07: solo admin).
  @Get('programas/:id/diagnostico')
  async diagnostico(
    @Param('id') programaId: string,
    @Query('export') exportar: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    const detalle = await this.resultados.diagnosticoDetalle(programaId);
    if (exportar !== 'xlsx') return detalle;

    const workbook = new ExcelJS.Workbook();

    const comparativo = workbook.addWorksheet('Comparativo');
    comparativo.addRow(['Dimensión', 'Inicial (promedio)', 'Final (promedio)']);
    for (const fila of detalle.comparativo) {
      comparativo.addRow([fila.dimension, fila.inicial, fila.final]);
    }

    for (const [nombre, bloque] of [
      ['Inicial', detalle.inicial],
      ['Final', detalle.final],
    ] as const) {
      const dimensiones = bloque.dimensiones.map(d => d.dimension);
      const sheet = workbook.addWorksheet(nombre);
      sheet.addRow(['Participante', 'Email', 'Enviado', ...dimensiones]);
      for (const ind of bloque.individuales) {
        sheet.addRow([
          ind.usuario.nombre,
          ind.usuario.email,
          ind.enviadoEn ? new Date(ind.enviadoEn).toISOString() : '',
          ...dimensiones.map(d => ind.scores?.[d]?.promedio ?? null),
        ]);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="diagnostico.xlsx"',
    });
    return new StreamableFile(Buffer.from(buffer));
  }
}
