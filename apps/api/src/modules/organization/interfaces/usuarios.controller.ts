import { Controller, Get, Post, Body } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';

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
  async create(@Body() body: { nombre: string; cargo: string; empresaId: string }) {
    return this.prisma.usuario.create({
      data: {
        id: randomUUID(),
        nombre: body.nombre,
        cargo: body.cargo,
        empresaId: body.empresaId
      }
    });
  }
}
