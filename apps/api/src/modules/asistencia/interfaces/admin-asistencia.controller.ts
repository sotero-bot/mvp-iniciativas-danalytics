import { Body, Controller, Get, Param, Patch, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../auth/guards/auth-user';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

interface PatchAsistenciaDto {
  presente?: boolean;
  nota?: string | null;
}

interface ResumenRow {
  usuarioId: string;
  nombre: string;
  email: string;
  porSesion: Record<string, boolean>;
  porcentaje: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminAsistenciaController {
  constructor(private readonly prisma: PrismaService) {}

  // RF-19: el admin edita sin límite de 24 h (a diferencia del facilitador).
  @Roles('danalytics_admin')
  @Patch('asistencia/:id')
  async updateAsistencia(@Param('id') id: string, @Body() body: PatchAsistenciaDto) {
    const existing = await this.prisma.asistencia.findUnique({ where: { id } });
    if (!existing) throw new AppError('ASISTENCIA_NOT_FOUND');
    return this.prisma.asistencia.update({
      where: { id },
      data: {
        presente: body.presente !== undefined ? body.presente : existing.presente,
        nota: body.nota !== undefined ? body.nota : existing.nota,
      },
    });
  }

  // RF-20/RN-07: admin y roles cliente ven el resumen (el facilitador NO exporta ni ve esta vista).
  @Roles('danalytics_admin', ...CLIENTE_ROLE_SLUGS)
  @Get('programas/:id/asistencia/resumen')
  async resumen(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    return this.buildResumen(programaId, actor);
  }

  // RF-21/RN-07: solo danalytics_admin exporta.
  @Roles('danalytics_admin')
  @Get('programas/:id/asistencia/export')
  async exportar(
    @Param('id') programaId: string,
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
  ) {
    const { sesiones, filas } = await this.buildResumen(programaId, actor);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Asistencia');
    sheet.addRow(['Participante', 'Email', ...sesiones.map(s => `Sesión ${s.numeroSesion}`), '%']);
    for (const fila of filas) {
      sheet.addRow([
        fila.nombre,
        fila.email,
        ...sesiones.map(s => (fila.porSesion[s.id] ? 'Sí' : 'No')),
        `${Math.round(fila.porcentaje * 100)}%`,
      ]);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="asistencia.xlsx"',
    });
    res.send(Buffer.from(buffer));
  }

  private async buildResumen(
    programaId: string,
    actor: AuthUser,
  ): Promise<{ sesiones: { id: string; numeroSesion: number }[]; filas: ResumenRow[] }> {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    if (
      (actor.role === 'cliente_admin' || actor.role === 'usuario_cliente') &&
      programa.empresaId !== actor.empresaId
    ) {
      throw new AppError('FORBIDDEN');
    }

    const [sesiones, participantes, asistencias] = await Promise.all([
      this.prisma.sesion.findMany({
        where: { programaId },
        select: { id: true, numeroSesion: true },
        orderBy: { numeroSesion: 'asc' },
      }),
      this.prisma.participantePrograma.findMany({
        where: { programaId, activo: true },
        select: { usuarioId: true, usuario: { select: { id: true, nombre: true, email: true } } },
      }),
      this.prisma.asistencia.findMany({ where: { sesion: { programaId } } }),
    ]);

    const totalSesiones = sesiones.length || 1;
    const filas: ResumenRow[] = participantes.map(p => {
      const propias = asistencias.filter(a => a.usuarioId === p.usuarioId);
      const porSesion: Record<string, boolean> = {};
      for (const a of propias) porSesion[a.sesionId] = a.presente;
      const presentes = propias.filter(a => a.presente).length;
      return {
        usuarioId: p.usuarioId,
        nombre: p.usuario.nombre,
        email: p.usuario.email,
        porSesion,
        porcentaje: presentes / totalSesiones,
      };
    });

    return { sesiones, filas };
  }
}
