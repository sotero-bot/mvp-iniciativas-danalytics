import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';

const MAX_PAGE = 200;

// RNF-13 (Plan 2 §4.1): el log de auditoría es APPEND-ONLY — este controller
// SOLO expone lectura y únicamente a `danalytics_admin`. Las filas las escribe
// el RegistroAccesoInterceptor global; no existe ningún endpoint de escritura,
// edición ni borrado del log.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('admin')
export class AdminRegistroAccesoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('registro-acceso')
  async list(
    @Query('usuarioId') usuarioId?: string,
    @Query('role') role?: string,
    @Query('accion') accion?: string,
    @Query('tipoRecurso') tipoRecurso?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const where: Prisma.RegistroAccesoWhereInput = {};
    if (usuarioId) where.usuarioId = usuarioId;
    if (role) where.role = role;
    if (accion) where.accion = accion;
    if (tipoRecurso) where.tipoRecurso = tipoRecurso;
    if (desde || hasta) {
      where.creadoEn = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      };
    }

    const takeN = Math.min(Math.max(parseInt(take ?? '', 10) || 50, 1), MAX_PAGE);
    const skipN = Math.max(parseInt(skip ?? '', 10) || 0, 0);

    const [total, filas] = await Promise.all([
      this.prisma.registroAcceso.count({ where }),
      this.prisma.registroAcceso.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        take: takeN,
        skip: skipN,
      }),
    ]);

    // `usuarioId` es soft-ref (sin FK): resolvemos los nombres en una segunda
    // query para que el visor no muestre solo UUIDs.
    const ids = [...new Set(filas.map(f => f.usuarioId))];
    const usuarios = ids.length
      ? await this.prisma.usuario.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true, email: true },
        })
      : [];
    const porId = new Map(usuarios.map(u => [u.id, u]));

    return {
      total,
      filas: filas.map(f => ({ ...f, usuario: porId.get(f.usuarioId) ?? null })),
    };
  }
}
