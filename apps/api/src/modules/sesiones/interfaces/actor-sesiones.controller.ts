import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { S3Service } from '../../storage/S3Service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

// C-03: el facilitador ve la presentación desde 7 días calendario antes de la sesión.
const FACILITADOR_ANTELACION_MS = 7 * 24 * 60 * 60 * 1000;
// RF-09 (aclaración 2026-07-17): el estudiante ve los recursos 24 h DESPUÉS de la sesión.
const ESTUDIANTE_ESPERA_MS = 24 * 60 * 60 * 1000;

const SESION_SELECT = {
  id: true,
  programaId: true,
  numeroSesion: true,
  titulo: true,
  descripcion: true,
  fechaProgramada: true,
  materialArchivoKey: true,
  urlPresentacion: true,
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
      select: {
        id: true,
        nombre: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        empresa: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('programas/:id/sesiones')
  async listSesiones(@Param('id') programaId: string, @CurrentUser() actor: AuthUser) {
    await this.scope.assertProgramaAccessible(this.prisma, actor, programaId);
    const [sesiones, programa] = await Promise.all([
      this.prisma.sesion.findMany({
        where: { programaId },
        select: SESION_SELECT,
        orderBy: { numeroSesion: 'asc' },
      }),
      // C-01: los facilitadores son del programa (N:M), no de la sesión; se
      // adjuntan a cada sesión para que el estudiante vea de quién es. Siempre
      // visibles (el nombre no es material, no se gatea).
      this.prisma.programa.findUnique({
        where: { id: programaId },
        select: {
          timezone: true,
          facilitadores: { select: { usuario: { select: { id: true, nombre: true } } } },
        },
      }),
    ]);
    const facilitadores = (programa?.facilitadores ?? []).map((f) => f.usuario);
    const timezone = programa?.timezone ?? 'UTC';
    const now = Date.now();
    return sesiones.map((s) => {
      const bloqueada = this.estaBloqueada(s, actor.role, now);
      // No filtrar los enlaces (presentación/grabación) mientras la sesión siga
      // bloqueada para el rol: el gating es servidor, no solo cosmético en la UI.
      return {
        ...s,
        facilitadores,
        timezone,
        urlPresentacion: bloqueada ? null : s.urlPresentacion,
        urlGrabacion: bloqueada ? null : s.urlGrabacion,
        bloqueada,
        desbloqueaEn: this.desbloqueoEn(s, actor.role).toISOString(),
      };
    });
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
    // La URL de la presentación se entrega junto al material (mismo gating de arriba).
    return { url, urlPresentacion: sesion.urlPresentacion, urlGrabacion: sesion.urlGrabacion };
  }

  // C-04 (aclaración 2026-07-14): el facilitador sube el enlace de grabación de una
  // sesión suya. El admin sube la presentación/material; la grabación la pone el
  // facilitador tras dar la sesión. Solo sesión actual o pasada (SESION_FUTURA si no).
  @Patch('facilitador/sesiones/:id/grabacion')
  @Roles('facilitador')
  async subirGrabacion(
    @Param('id') sesionId: string,
    @Body() body: { urlGrabacion: string | null },
    @CurrentUser() actor: AuthUser,
  ) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { id: sesionId },
      select: { id: true, programaId: true, fechaProgramada: true },
    });
    if (!sesion) throw new AppError('SESION_NOT_FOUND');
    await this.scope.assertProgramaAccessible(this.prisma, actor, sesion.programaId);
    if (sesion.fechaProgramada.getTime() > Date.now()) throw new AppError('SESION_FUTURA');
    const url = body?.urlGrabacion?.trim() || null;
    await this.prisma.sesion.update({ where: { id: sesionId }, data: { urlGrabacion: url } });
    return { id: sesionId, urlGrabacion: url };
  }

  private estaBloqueada(
    sesion: { fechaProgramada: Date; materialDesbloqueoEn: Date | null },
    role: AuthUser['role'],
    now: number,
  ): boolean {
    return this.desbloqueoEn(sesion, role).getTime() > now;
  }

  // Momento en que los recursos de la sesión quedan disponibles para el rol.
  private desbloqueoEn(
    sesion: { fechaProgramada: Date },
    role: AuthUser['role'],
  ): Date {
    if (role === 'facilitador') {
      // C-03 (aclaración 2026-07-14): el facilitador ve la presentación desde 7 días
      // calendario antes de la fecha de la sesión.
      return new Date(sesion.fechaProgramada.getTime() - FACILITADOR_ANTELACION_MS);
    }
    // RF-09 (aclaración 2026-07-17): el estudiante ve los recursos (presentación /
    // grabación) 24 h DESPUÉS de que la sesión ocurrió; antes, bloqueada.
    return new Date(sesion.fechaProgramada.getTime() + ESTUDIANTE_ESPERA_MS);
  }
}
