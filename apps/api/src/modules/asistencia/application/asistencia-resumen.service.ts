import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';

export interface AsistenciaResumenSesion {
  id: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: Date;
}

export interface AsistenciaResumenFila {
  usuarioId: string;
  nombre: string;
  email: string;
  area: string | null; // HU-14: nombre del área del catálogo
  porSesion: Record<string, boolean>;
  porcentaje: number;
}

export interface AsistenciaResumen {
  sesiones: AsistenciaResumenSesion[];
  filas: AsistenciaResumenFila[];
}

// RF-20/RF-21: matriz sesión × participante (asistió/no asistió/no registrado) con
// % por participante, y su export a Excel. Compartido entre admin y facilitador —
// cada controller aplica su propia autorización antes de llamar a este servicio.
@Injectable()
export class AsistenciaResumenService {
  constructor(private readonly prisma: PrismaService) {}

  // `usuarioWhere` (HU-14): restringe la matriz a los participantes que cumplen la condición (p. ej. un área).
  async build(programaId: string, usuarioWhere?: Prisma.UsuarioWhereInput): Promise<AsistenciaResumen> {
    const [sesiones, participantes, asistencias] = await Promise.all([
      this.prisma.sesion.findMany({
        where: { programaId },
        select: { id: true, numeroSesion: true, titulo: true, fechaProgramada: true },
        orderBy: { numeroSesion: 'asc' },
      }),
      this.prisma.participantePrograma.findMany({
        where: { programaId, activo: true, ...(usuarioWhere ? { usuario: usuarioWhere } : {}) },
        select: {
          usuarioId: true,
          usuario: { select: { id: true, nombre: true, email: true, areaCatalogo: { select: { id: true, nombre: true } } } },
        },
      }),
      this.prisma.asistencia.findMany({ where: { sesion: { programaId } } }),
    ]);

    const totalSesiones = sesiones.length || 1;
    const filas: AsistenciaResumenFila[] = participantes.map((p) => {
      const propias = asistencias.filter((a) => a.usuarioId === p.usuarioId);
      const porSesion: Record<string, boolean> = {};
      for (const a of propias) porSesion[a.sesionId] = a.presente;
      const presentes = propias.filter((a) => a.presente).length;
      return {
        usuarioId: p.usuarioId,
        nombre: p.usuario.nombre,
        email: p.usuario.email,
        area: p.usuario.areaCatalogo?.nombre ?? null,
        porSesion,
        porcentaje: presentes / totalSesiones,
      };
    });

    return { sesiones, filas };
  }

  async buildWorkbook(programaId: string): Promise<ExcelJS.Workbook> {
    const { sesiones, filas } = await this.build(programaId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Asistencia');
    sheet.addRow(['Participante', 'Email', ...sesiones.map((s) => `S${s.numeroSesion} · ${s.titulo}`), '%']);
    for (const fila of filas) {
      sheet.addRow([
        fila.nombre,
        fila.email,
        ...sesiones.map((s) => (fila.porSesion[s.id] ? 'Sí' : 'No')),
        `${Math.round(fila.porcentaje * 100)}%`,
      ]);
    }
    return workbook;
  }
}
