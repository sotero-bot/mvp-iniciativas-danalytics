import { Controller, Post, Headers, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Controller('admin/reset')
export class AdminResetController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async resetData(@Headers('x-reset-secret') secret: string) {
    const expected = process.env.RESET_SECRET;
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Acceso denegado');
    }

    const interacciones   = await this.prisma.interaccion.deleteMany();
    const instancias      = await this.prisma.instanciaActividad.deleteMany();
    const enlaces         = await this.prisma.enlaceActividad.deleteMany();
    const pasoActividad   = await this.prisma.pasoActividad.deleteMany();
    const actividades     = await this.prisma.actividad.deleteMany();
    const pasoPlantilla   = await this.prisma.pasoPlantilla.deleteMany();
    const plantillas      = await this.prisma.plantillaActividad.deleteMany();
    const iniciativas     = await this.prisma.iniciativa.deleteMany();
    const usuarios        = await this.prisma.usuario.deleteMany();
    const empresas        = await this.prisma.empresa.deleteMany();

    return {
      ok: true,
      eliminados: {
        interacciones:  interacciones.count,
        instancias:     instancias.count,
        enlaces:        enlaces.count,
        pasoActividad:  pasoActividad.count,
        actividades:    actividades.count,
        pasoPlantilla:  pasoPlantilla.count,
        plantillas:     plantillas.count,
        iniciativas:    iniciativas.count,
        usuarios:       usuarios.count,
        empresas:       empresas.count,
      },
    };
  }
}
