import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';
import { AppError } from '../../../shared/errors/AppError';

export class InstanciarPlantillaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(plantillaId: string, iniciativaId: string, nombre: string, descripcion?: string) {
    const plantilla = await this.prisma.plantillaActividad.findUnique({
      where: { id: plantillaId, activo: true },
      include: {
        pasos: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
          include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
        },
      },
    });

    if (!plantilla) throw new AppError('PLANTILLA_NOT_FOUND');
    if (plantilla.pasos.length === 0) {
      throw new AppError('VALIDATION_ERROR', { message: 'La plantilla no tiene pasos configurados. Agrega al menos un paso antes de instanciarla.' });
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

      const pasosConId = plantilla.pasos.map((p) => ({ ...p, newId: randomUUID() }));

      await tx.pasoActividad.createMany({
        data: pasosConId.map((p) => ({
          id: p.newId,
          actividadId: actividad.id,
          titulo: p.titulo,
          objetivo: p.objetivo,
          instrucciones: p.instrucciones,
          usarIa: p.usarIa,
          iaAutomatica: p.iaAutomatica,
          promptIa: p.promptIa,
          permitirArchivo: p.permitirArchivo,
          soloArchivo: p.soloArchivo,
          urlPlantilla: p.urlPlantilla,
          ejemploKey: p.ejemploKey,
          orden: p.orden,
        })),
      });

      const todasLasPreguntas = pasosConId.flatMap((p) =>
        p.preguntas.map((q) => ({
          id: randomUUID(),
          pasoId: p.newId,
          orden: q.orden,
          enunciado: q.enunciado,
          permitirArchivo: q.permitirArchivo,
          soloArchivo: q.soloArchivo,
          subirArchivoS3: q.subirArchivoS3,
          usarIa: q.usarIa,
          iaAutomatica: q.iaAutomatica,
          promptIa: q.promptIa,
          urlPlantilla: q.urlPlantilla,
          urlPromptTemplate: q.urlPromptTemplate,
        })),
      );

      if (todasLasPreguntas.length > 0) {
        await tx.preguntaActividad.createMany({ data: todasLasPreguntas });
      }

      return actividad;
    });
  }
}
