import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma.service';

@Controller('organization/empresas')
export class EmpresasController {
  constructor(private readonly prisma: PrismaService) {} 

  @Get()
  async findAll() {
    return this.prisma.empresa.findMany();
  }

  @Post()
  async create(@Body() body: { nombre: string }) {
    return this.prisma.empresa.create({
      data: {
        id: randomUUID(),
        nombre: body.nombre
      }
    });
  }
}
