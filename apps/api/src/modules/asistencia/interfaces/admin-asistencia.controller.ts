import { Body, Controller, Get, Param, Patch, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../auth/guards/auth-user';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';
import { AsistenciaResumenService } from '../application/asistencia-resumen.service';

interface PatchAsistenciaDto {
  presente?: boolean;
  nota?: string | null;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminAsistenciaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistenciaResumen: AsistenciaResumenService,
  ) {}

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

  // RF-20/RN-07: admin y roles cliente ven el resumen (el facilitador tiene su
  // propio endpoint equivalente en FacilitadorAsistenciaController).
  @Roles('danalytics_admin', ...CLIENTE_ROLE_SLUGS)
  @Get('programas/:id/asistencia/resumen')
  async resumen(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.assertAccesible(programaId, actor);
    return this.asistenciaResumen.build(programaId);
  }

  // RF-21/RN-07: solo danalytics_admin exporta desde esta vista.
  @Roles('danalytics_admin')
  @Get('programas/:id/asistencia/export')
  async exportar(
    @Param('id') programaId: string,
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
  ) {
    await this.assertAccesible(programaId, actor);
    const workbook = await this.asistenciaResumen.buildWorkbook(programaId);
    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="asistencia.xlsx"',
    });
    res.send(Buffer.from(buffer));
  }

  private async assertAccesible(programaId: string, actor: AuthUser): Promise<void> {
    const programa = await this.prisma.programa.findUnique({ where: { id: programaId } });
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');
    if (
      (actor.role === 'cliente_admin' || actor.role === 'usuario_cliente') &&
      programa.empresaId !== actor.empresaId
    ) {
      throw new AppError('FORBIDDEN');
    }
  }
}
