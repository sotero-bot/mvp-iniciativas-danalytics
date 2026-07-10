import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../auth/guards';

// RNF-01/RNF-02: el registro de usuarios es exclusivo de danalytics_admin.
// Ni facilitador ni ningún otro rol puede crear usuarios por esta vía.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('danalytics_admin')
@Controller('organization/usuarios')
export class UsuariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    return this.prisma.usuario.findMany({
      include: { empresa: true }
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; email: string; cargo: string; empresaId: string }) {
    return this.prisma.usuario.create({
      data: {
        id: randomUUID(),
        nombre: body.nombre,
        email: body.email?.toLowerCase().trim(),
        cargo: body.cargo,
        empresaId: body.empresaId
      }
    });
  }
}
