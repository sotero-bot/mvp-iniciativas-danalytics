import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { EstadoSesion } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

const EDICION_VENTANA_MS = 24 * 60 * 60 * 1000; // RF-19: 24 h desde el primer registro

interface RegistroAsistenciaDto {
  usuarioId: string;
  presente: boolean;
  nota?: string | null;
}

interface PutAsistenciaDto {
  registros: RegistroAsistenciaDto[];
}

// RF-17/RF-18/RF-19/RF-10: el facilitador toma asistencia de sus sesiones.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador')
@Controller('facilitador')
export class FacilitadorAsistenciaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
  ) {}

  @Get('sesiones/:id/asistencia')
  async listAsistencia(@Param('id') sesionId: string, @CurrentUser() actor: AuthUser) {
    const sesion = await this.getSesionOrThrow(sesionId);
    await this.scope.assertProgramaAccessible(this.prisma, actor, sesion.programaId);

    const [participantes, asistencias] = await Promise.all([
      this.prisma.participantePrograma.findMany({
        where: { programaId: sesion.programaId, activo: true },
        select: { usuarioId: true, usuario: { select: { id: true, nombre: true, email: true } } },
      }),
      this.prisma.asistencia.findMany({ where: { sesionId } }),
    ]);
    const porUsuario = new Map(asistencias.map(a => [a.usuarioId, a]));
    return participantes.map(p => ({
      usuarioId: p.usuarioId,
      nombre: p.usuario.nombre,
      email: p.usuario.email,
      presente: porUsuario.get(p.usuarioId)?.presente ?? false,
      nota: porUsuario.get(p.usuarioId)?.nota ?? null,
      registrado: porUsuario.has(p.usuarioId),
    }));
  }

  @Put('sesiones/:id/asistencia')
  async putAsistencia(
    @Param('id') sesionId: string,
    @Body() body: PutAsistenciaDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const sesion = await this.getSesionOrThrow(sesionId);
    await this.scope.assertProgramaAccessible(this.prisma, actor, sesion.programaId);

    // RF-18: solo sesión actual o anteriores.
    if (sesion.fechaProgramada.getTime() > Date.now()) {
      throw new AppError('SESION_FUTURA');
    }

    const existentes = await this.prisma.asistencia.findMany({ where: { sesionId } });
    const existentesPorUsuario = new Map(existentes.map(a => [a.usuarioId, a]));

    // RF-19: ventana de edición de 24 h desde el primer registro de cada fila.
    for (const registro of body.registros) {
      const previa = existentesPorUsuario.get(registro.usuarioId);
      if (previa && Date.now() - previa.createdAt.getTime() > EDICION_VENTANA_MS) {
        throw new AppError('ASISTENCIA_FUERA_DE_PLAZO');
      }
    }

    for (const registro of body.registros) {
      const previa = existentesPorUsuario.get(registro.usuarioId);
      if (previa) {
        await this.prisma.asistencia.update({
          where: { id: previa.id },
          data: { presente: registro.presente, nota: registro.nota ?? null },
        });
      } else {
        await this.prisma.asistencia.create({
          data: {
            id: randomUUID(),
            sesionId,
            usuarioId: registro.usuarioId,
            presente: registro.presente,
            nota: registro.nota ?? null,
            registradoPorId: actor.sub,
          },
        });
      }
    }

    // RF-10: modo automático marca la sesión completada al guardar asistencia.
    const programa = await this.prisma.programa.findUnique({
      where: { id: sesion.programaId },
      select: { marcarSesionAutomatica: true },
    });
    if (programa?.marcarSesionAutomatica) {
      await this.prisma.sesion.update({
        where: { id: sesionId },
        data: { estado: EstadoSesion.completada },
      });
    }

    return this.listAsistencia(sesionId, actor);
  }

  private async getSesionOrThrow(sesionId: string) {
    const sesion = await this.prisma.sesion.findUnique({ where: { id: sesionId } });
    if (!sesion) throw new AppError('SESION_NOT_FOUND');
    return sesion;
  }
}
