import { Controller, Get, UseGuards } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../../auth/guards';
import { CLIENTE_ROLE_SLUGS } from '../../auth/guards/auth-user';
import type { AuthUser } from '../../auth/guards';

// HU-14: catálogo de áreas de la empresa del actor. SOLO LECTURA.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CLIENTE_ROLE_SLUGS)
@Controller('portal/areas')
export class PortalAreasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() actor: AuthUser) {
    if (!actor.empresaId) throw new AppError('PORTAL_ACCESO_DENEGADO');
    return this.prisma.areaEmpresa.findMany({
      where: { empresaId: actor.empresaId, activo: true },
      select: {
        id: true,
        nombre: true,
        orden: true,
        _count: { select: { usuarios: true } },
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }
}
