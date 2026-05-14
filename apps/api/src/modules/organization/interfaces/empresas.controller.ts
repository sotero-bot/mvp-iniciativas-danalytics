import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../../../prisma.service';
import { extractTextFromFile } from '../../../shared/utils/extractTextFromFile';

@Controller('organization/empresas')
export class EmpresasController {
  constructor(private readonly prisma: PrismaService) { }

  @Get()
  async findAll() {
    return this.prisma.empresa.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        logoUrl: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
        contextoPdfNombre: true,
        contextoPdfActualizadoEn: true,
      }
    });
  }

  @Post()
  async create(@Body() body: { nombre: string; logoUrl?: string }) {
    return this.prisma.empresa.create({
      data: {
        id: randomUUID(),
        nombre: body.nombre,
        logoUrl: body.logoUrl ?? null,
      }
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { nombre?: string; logoUrl?: string | null }) {
    const data: any = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if ('logoUrl' in body) data.logoUrl = body.logoUrl ?? null;
    return this.prisma.empresa.update({ where: { id }, data });
  }

  @Post(':id/contexto-pdf')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + path.extname(file.originalname));
        }
      }),
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async subirContextoPdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');

    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      throw new BadRequestException('Solo se admiten archivos PDF');
    }

    try {
      const texto = await extractTextFromFile(file.path, file.mimetype, file.originalname);
      const actualizadoEn = new Date();
      await this.prisma.empresa.update({
        where: { id },
        data: {
          contextoPdfNombre: file.originalname,
          contextoPdfTexto: texto,
          contextoPdfActualizadoEn: actualizadoEn,
        }
      });
      return {
        nombre: file.originalname,
        longitudTexto: texto.length,
        actualizadoEn: actualizadoEn.toISOString(),
      };
    } finally {
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    }
  }

  @Delete(':id/contexto-pdf')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarContextoPdf(@Param('id') id: string) {
    await this.prisma.empresa.update({
      where: { id },
      data: {
        contextoPdfNombre: null,
        contextoPdfTexto: null,
        contextoPdfActualizadoEn: null,
      }
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id') id: string) {
    // Cascade: deactivate instancias of all actividades
    const actividades = await this.prisma.actividad.findMany({
      where: { iniciativa: { empresaId: id } },
      select: { id: true }
    });
    const actividadIds = actividades.map(a => a.id);

    await this.prisma.instanciaActividad.updateMany({
      where: { actividadId: { in: actividadIds } },
      data: { activo: false }
    });
    await this.prisma.pasoActividad.updateMany({
      where: { actividadId: { in: actividadIds } },
      data: { activo: false }
    });
    await this.prisma.actividad.updateMany({
      where: { id: { in: actividadIds } },
      data: { activo: false }
    });
    await this.prisma.iniciativa.updateMany({
      where: { empresaId: id },
      data: { activo: false }
    });
    await this.prisma.empresa.update({
      where: { id },
      data: { activo: false }
    });
  }
}
