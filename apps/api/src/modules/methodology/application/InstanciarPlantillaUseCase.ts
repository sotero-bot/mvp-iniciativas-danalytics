import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';

export class InstanciarPlantillaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(plantillaId: string, iniciativaId: string, nombre: string, descripcion?: string) {
    const plantilla = await this.prisma.plantillaActividad.findUnique({
      where: { id: plantillaId, activo: true },
      include: { pasos: { where: { activo: true }, orderBy: { orden: 'asc' } } },
    });

    if (!plantilla) throw new NotFoundException('Plantilla no encontrada o inactiva');
    if (plantilla.pasos.length === 0) {
      throw new BadRequestException('La plantilla no tiene pasos configurados. Agrega al menos un paso antes de instanciarla.');
    }

    return this.prisma.$transaction(async (tx) => {
      const actividad = await tx.actividad.create({
        data: {
          id: randomUUID(),
          nombre,
          descripcion,
          iniciativaId,
          plantillaOrigenId: plantillaId,
        },
      });

      await tx.pasoActividad.createMany({
        data: plantilla.pasos.map((p) => ({
          id: randomUUID(),
          actividadId: actividad.id,
          titulo: p.titulo,
          objetivo: p.objetivo,
          instrucciones: p.instrucciones,
          usarIa: p.usarIa,
          promptIa: p.promptIa,
          orden: p.orden,
        })),
      });

      return actividad;
    });
  }
}
