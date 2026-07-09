import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { S3Service } from '../../storage/S3Service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

const SESION_SELECT = {
  id: true,
  programaId: true,
  numeroSesion: true,
  titulo: true,
  descripcion: true,
  fechaProgramada: true,
  materialArchivoKey: true,
  urlGrabacion: true,
  materialDesbloqueoEn: true,
  estado: true,
};

// RF-06/RF-08/RF-09/RNF-03/RNF-08: gating de sesiones para facilitador/estudiante
// y URL firmada de corta duración para el material.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('facilitador', 'estudiante')
@Controller()
export class ActorSesionesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
    private readonly s3: S3Service,
  ) {}

  // Glue mínimo para que la UI pueda listar "mis programas" antes de poder pedir
  // sesiones/material de uno concreto (los endpoints de Fase 1 asumen programaId
  // conocido). Reutiliza el mismo fragmento WHERE que assertProgramaAccessible.
  @Get('programas')
  async listMisProgramas(@CurrentUser() actor: AuthUser) {
    return this.prisma.programa.findMany({
      where: this.scope.programaScope(actor),
      select: { id: true, nombre: true, estado: true, fechaInicio: true, fechaFin: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('programas/:id/sesiones')
  async listSesiones(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    const sesiones = await this.prisma.sesion.findMany({
      where: { programaId },
      select: SESION_SELECT,
      orderBy: { numeroSesion: 'asc' },
    });
    const now = Date.now();
    return sesiones.map((s) => ({ ...s, bloqueada: this.estaBloqueada(s, actor.role, now) }));
  }

  @Get('sesiones/:id/material')
  async getMaterial(@Param('id') sesionId: string, @CurrentUser() actor: AuthUser) {
    const sesion = await this.prisma.sesion.findUnique({ where: { id: sesionId }, select: SESION_SELECT });
    if (!sesion) throw new AppError('SESION_NOT_FOUND');
    await this.scope.assertProgramaAccessible(this.prisma, actor, sesion.programaId);

    if (this.estaBloqueada(sesion, actor.role, Date.now())) {
      throw new AppError('SESION_BLOQUEADA');
    }

    // RNF-03: URL firmada de expiración corta (≤ 1 h), generada on-demand; sin
    // downloadFilename para que quede "inline" y el visor de PDF.js pueda
    // renderizarla en <canvas> en vez de forzar descarga.
    const url = sesion.materialArchivoKey ? await this.s3.getPresignedGetUrl(sesion.materialArchivoKey, 3600) : null;
    return { url, urlGrabacion: sesion.urlGrabacion };
  }

  private estaBloqueada(
    sesion: { fechaProgramada: Date; materialDesbloqueoEn: Date | null },
    role: AuthUser['role'],
    now: number,
  ): boolean {
    if (role === 'facilitador') {
      // RF-08/RN-01: el facilitador ve la sesión actual y anteriores de su programa.
      return sesion.fechaProgramada.getTime() > now;
    }
    // RF-09/RN-05: el estudiante ve el material desde las 00:01 del día siguiente.
    return !sesion.materialDesbloqueoEn || sesion.materialDesbloqueoEn.getTime() > now;
  }
}
