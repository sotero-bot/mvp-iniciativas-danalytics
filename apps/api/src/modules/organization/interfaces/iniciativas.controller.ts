import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';

@Controller('organization/iniciativas')
export class IniciativasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('empresaId') empresaId?: string) {
    console.log(`[IniciativasController] GET /iniciativas - empresaId: ${empresaId}`);
    if (empresaId) {
      return this.prisma.iniciativa.findMany({
        where: { empresaId }
      });
    }
    return this.prisma.iniciativa.findMany({
      include: { empresa: true }
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; descripcion?: string; empresaId: string }) {
    console.log(`[IniciativasController] POST /iniciativas - body:`, body);
    try {
      const res = await this.prisma.iniciativa.create({
        data: {
          id: randomUUID(),
          nombre: body.nombre,
          descripcion: body.descripcion,
          empresaId: body.empresaId
        }
      });
      console.log(`[IniciativasController] Iniciativa creada OK:`, res.id);
      return res;
    } catch (e: any) {
      console.error(`[IniciativasController] ERROR CREANDO INICIATIVA:`, e.message);
      throw e;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.iniciativa.findUnique({
      where: { id },
      include: { empresa: true, actividades: true }
    });
  }
}
