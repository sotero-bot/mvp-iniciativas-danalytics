import { IActividadRepository, Actividad } from '../domain/Actividad';
import { PrismaService } from '../../../prisma.service';

export class PrismaActividadRepository implements IActividadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(actividad: Actividad): Promise<void> {
    await this.prisma.actividad.upsert({
      where: { id: actividad.id },
      create: {
        id: actividad.id,
        nombre: actividad.nombre,
        estado: actividad.estado,
        iniciativaId: actividad.config.iniciativaId, // Asumiendo estructura de config o similar
      },
      update: {
        nombre: actividad.nombre,
        estado: actividad.estado,
      },
    });
  }

  async findById(id: string): Promise<Actividad | null> {
    const raw = await this.prisma.actividad.findUnique({
      where: { id },
    });

    if (!raw) return null;

    return new Actividad(
      raw.id,
      raw.nombre,
      raw.estado,
      { iniciativaId: raw.iniciativaId }
    );
  }
}
