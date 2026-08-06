import { Controller, Get, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';
import { ResultadosService } from '../application/resultados.service';
import { formatValorLegible } from '../application/agregados';

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

    // Escala y selección van en hojas separadas: nunca se combinan en un mismo
    // promedio ni en la misma tabla (ver scoring.ts).
    for (const [nombre, filas] of [
      ['Comparativo - Escala', detalle.comparativo.escala],
      ['Comparativo - Selección', detalle.comparativo.seleccion],
    ] as const) {
      const sheet = workbook.addWorksheet(nombre);
      sheet.addRow(['Dimensión', 'Inicial (promedio)', 'Final (promedio)']);
      for (const fila of filas) sheet.addRow([fila.dimension, fila.inicial, fila.final]);
    }

    for (const [nombre, bloque] of [
      ['Inicial', detalle.inicial],
      ['Final', detalle.final],
    ] as const) {
      const dimEscala = bloque.dimensiones.escala.map(d => d.dimension);
      const dimSeleccion = bloque.dimensiones.seleccion.map(d => d.dimension);
      const sheet = workbook.addWorksheet(nombre);
      sheet.addRow([
        'Participante',
        'Email',
        'Enviado',
        ...dimEscala.map(d => `Escala: ${d}`),
        ...dimSeleccion.map(d => `Selección: ${d}`),
      ]);
      for (const ind of bloque.individuales) {
        sheet.addRow([
          ind.usuario.nombre,
          ind.usuario.email,
          ind.enviadoEn ? new Date(ind.enviadoEn).toISOString() : '',
          ...dimEscala.map(d => ind.scores?.escala?.[d]?.promedio ?? null),
          ...dimSeleccion.map(d => ind.scores?.seleccion?.[d]?.promedio ?? null),
        ]);
      }
    }

    // Por pregunta (opción múltiple → conteo; likert/número → promedio; texto →
    // cada respuesta en su fila), una hoja por bloque (igual que el global).
    for (const [nombre, bloque] of [
      ['Por pregunta - Inicial', detalle.inicial],
      ['Por pregunta - Final', detalle.final],
    ] as const) {
      const sheet = workbook.addWorksheet(nombre);
      sheet.addRow(['Pregunta', 'Tipo', 'Detalle', 'Valor', 'N']);
      for (const c of bloque.porCampo) {
        if ('opciones' in c) {
          for (const op of c.opciones) sheet.addRow([c.etiqueta, c.tipoCampo, op.etiqueta, op.conteo, c.n]);
        } else if ('promedio' in c) {
          sheet.addRow([c.etiqueta, c.tipoCampo, 'Promedio', c.promedio, c.n]);
        } else {
          if (c.textos.length === 0) sheet.addRow([c.etiqueta, c.tipoCampo, '', '', c.n]);
          for (const texto of c.textos) sheet.addRow([c.etiqueta, c.tipoCampo, 'Respuesta', texto, c.n]);
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="diagnostico.xlsx"',
    });
    return new StreamableFile(Buffer.from(buffer));
  }

  // Diagnóstico de inicio GLOBAL (RF-28): respuestas de la plantilla global
  // (programaId=null), no atadas a ningún programa. Con ?export=xlsx → Excel con
  // 3 hojas: dimensiones (scoring), por pregunta (conteo/promedio/textos) y la
  // matriz individual completa (cada persona × cada pregunta, legible).
  @Get('diagnostico-inicial-global')
  async diagnosticoInicialGlobal(
    @Query('export') exportar: string | undefined,
    @Query('empresaId') empresaId: string | undefined,
    @Query('programaId') programaId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const detalle = await this.resultados.diagnosticoInicialGlobal({ empresaId, programaId });
    if (exportar !== 'xlsx') return detalle;

    const workbook = new ExcelJS.Workbook();

    // Hoja 1 — Dimensiones (scoring agregado). Escala y selección por separado:
    // nunca se combinan en un mismo promedio (ver scoring.ts).
    const hDim = workbook.addWorksheet('Dimensiones - Escala');
    hDim.addRow(['Dimensión', 'Promedio', 'Respuestas']);
    for (const d of detalle.dimensiones.escala) hDim.addRow([d.dimension, d.promedio, d.n]);

    const hDimSel = workbook.addWorksheet('Dimensiones - Selección');
    hDimSel.addRow(['Dimensión', 'Promedio', 'Respuestas']);
    for (const d of detalle.dimensiones.seleccion) hDimSel.addRow([d.dimension, d.promedio, d.n]);

    // Hoja 2 — Por pregunta (opción múltiple → conteo; likert/número → promedio;
    // texto → cada respuesta en su fila).
    const hPreg = workbook.addWorksheet('Por pregunta');
    hPreg.addRow(['Pregunta', 'Tipo', 'Detalle', 'Valor', 'N']);
    for (const c of detalle.porCampo) {
      if ('opciones' in c) {
        for (const op of c.opciones) hPreg.addRow([c.etiqueta, c.tipoCampo, op.etiqueta, op.conteo, c.n]);
      } else if ('promedio' in c) {
        hPreg.addRow([c.etiqueta, c.tipoCampo, 'Promedio', c.promedio, c.n]);
      } else {
        if (c.textos.length === 0) hPreg.addRow([c.etiqueta, c.tipoCampo, '', '', c.n]);
        for (const texto of c.textos) hPreg.addRow([c.etiqueta, c.tipoCampo, 'Respuesta', texto, c.n]);
      }
    }

    // Hoja 3 — Respuestas individuales completas (una fila por persona, una
    // columna por pregunta de primer nivel, valores legibles).
    const camposTop = detalle.campos.filter(c => !c.campoPadreId).sort((a, b) => a.orden - b.orden);
    const hijosPorPadre = new Map<string, typeof detalle.campos>();
    for (const c of detalle.campos) {
      if (c.campoPadreId) {
        const arr = hijosPorPadre.get(c.campoPadreId) ?? [];
        arr.push(c);
        hijosPorPadre.set(c.campoPadreId, arr);
      }
    }
    const hInd = workbook.addWorksheet('Respuestas');
    hInd.addRow(['Participante', 'Email', 'Enviado', ...camposTop.map(c => c.etiqueta)]);
    for (const ind of detalle.individuales) {
      hInd.addRow([
        ind.usuario.nombre,
        ind.usuario.email,
        ind.enviadoEn ? new Date(ind.enviadoEn).toISOString() : '',
        ...camposTop.map(c => formatValorLegible(c, ind.datos[c.id], hijosPorPadre)),
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="diagnostico-inicial-global.xlsx"',
    });
    return new StreamableFile(Buffer.from(buffer));
  }
}
