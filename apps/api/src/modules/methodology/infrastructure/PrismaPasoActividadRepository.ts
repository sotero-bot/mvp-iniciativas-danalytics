import { IPasoActividadRepository } from '../domain/IPasoActividadRepository';
import { PasoActividad } from '../domain/PasoActividad';
import { PrismaService } from '../../../prisma.service';

export class PrismaPasoActividadRepository implements IPasoActividadRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(paso: PasoActividad): Promise<void> {
    await this.prisma.pasoActividad.create({
      data: {
        id: paso.id,
        actividadId: paso.actividadId,
        titulo: paso.titulo,
        orden: paso.orden,
        usarIa: paso.usarIa,
        iaAutomatica: paso.iaAutomatica,
        objetivo: paso.objetivo,
        instrucciones: paso.instrucciones,
        promptIa: paso.promptIa,
        permitirArchivo: paso.permitirArchivo,
        soloArchivo: paso.soloArchivo,
        urlPlantilla: paso.urlPlantilla,
      },
    });
  }

  async findByActividadId(actividadId: string): Promise<PasoActividad[]> {
    const raws = await this.prisma.pasoActividad.findMany({
      where: { actividadId },
      orderBy: { orden: 'asc' },
    });

    return raws.map(
      (raw) =>
        new PasoActividad(
          raw.id,
          raw.actividadId,
          raw.titulo,
          raw.orden,
          raw.usarIa,
          raw.objetivo || undefined,
          raw.instrucciones || undefined,
          raw.promptIa || undefined,
          (raw as any).permitirArchivo ?? false,
          (raw as any).soloArchivo ?? false,
          (raw as any).urlPlantilla || undefined,
          (raw as any).iaAutomatica ?? false,
        )
    );
  }

  async existsByActividadIdAndOrden(actividadId: string, orden: number): Promise<boolean> {
    const count = await this.prisma.pasoActividad.count({
      where: {
        actividadId,
        orden,
      },
    });
    return count > 0;
  }
}
