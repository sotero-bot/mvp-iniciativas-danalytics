import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';

// HU-14: catálogo de áreas por empresa. Exclusivo del panel admin.
// La baja es lógica (`activo = false`): los usuarios conservan su FK.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('organization/empresas/:empresaId/areas')
export class AdminAreasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Param('empresaId') empresaId: string, @Query('incluirInactivas') incluirInactivas?: string) {
    return this.prisma.areaEmpresa.findMany({
      where: incluirInactivas === '1' ? { empresaId } : { empresaId, activo: true },
      select: {
        id: true,
        empresaId: true,
        nombre: true,
        orden: true,
        activo: true,
        _count: { select: { usuarios: true } },
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  @Post()
  async create(@Param('empresaId') empresaId: string, @Body() body: { nombre: string }) {
    const nombre = this.nombreValido(body?.nombre);
    try {
      return await this.prisma.areaEmpresa.create({ data: { empresaId, nombre } });
    } catch (e) {
      throw this.mapDuplicado(e);
    }
  }

  @Patch(':id')
  async update(
    @Param('empresaId') empresaId: string,
    @Param('id') id: string,
    @Body() body: { nombre?: string; orden?: number; activo?: boolean },
  ) {
    await this.assertPertenece(empresaId, id);
    const data: Prisma.AreaEmpresaUpdateInput = {};
    if (body.nombre !== undefined) data.nombre = this.nombreValido(body.nombre);
    if (body.orden !== undefined) data.orden = body.orden;
    if (body.activo !== undefined) data.activo = body.activo;
    try {
      return await this.prisma.areaEmpresa.update({ where: { id }, data });
    } catch (e) {
      throw this.mapDuplicado(e);
    }
  }

  // Soft delete: nunca `delete` físico.
  @Delete(':id')
  async remove(@Param('empresaId') empresaId: string, @Param('id') id: string) {
    await this.assertPertenece(empresaId, id);
    return this.prisma.areaEmpresa.update({ where: { id }, data: { activo: false } });
  }

  private nombreValido(nombre: unknown): string {
    const limpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
    if (!limpio) throw new AppError('VALIDATION_ERROR');
    return limpio;
  }

  // Área de otra empresa → AREA_NOT_FOUND (no FORBIDDEN): no se filtra su existencia.
  private async assertPertenece(empresaId: string, id: string) {
    const area = await this.prisma.areaEmpresa.findUnique({ where: { id } });
    if (!area || area.empresaId !== empresaId) throw new AppError('AREA_NOT_FOUND');
    return area;
  }

  private mapDuplicado(e: unknown): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new AppError('AREA_DUPLICATE');
    }
    return e;
  }
}
