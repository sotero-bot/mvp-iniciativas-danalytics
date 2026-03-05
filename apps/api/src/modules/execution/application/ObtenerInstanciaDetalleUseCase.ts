import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { InstanciaDetalleResponseDto } from '../interfaces/dtos/instancia-detalle-response.dto';

export class ObtenerInstanciaDetalleUseCase {
  constructor(private readonly instanciaRepo: IInstanciaRepository) {}

  async execute(id: string): Promise<InstanciaDetalleResponseDto> {
    const raw = await this.instanciaRepo.findByIdWithRelations(id);

    if (!raw) {
      throw new ResourceNotFoundError('InstanciaActividad', id);
    }

    // Mapeo manual al DTO detallado
    return new InstanciaDetalleResponseDto({
      id: raw.id,
      estado: raw.estado,
      fechaInicio: raw.fechaInicio,
      fechaFin: raw.fechaFin,
      actividad: {
        id: raw.actividad.id,
        nombre: raw.actividad.nombre,
      },
      usuario: {
        id: raw.usuario.id,
        nombre: raw.usuario.nombre,
      },
      pasos: raw.actividad.pasos.map((paso: any) => {
        const interaccion = raw.interacciones.find((i: any) => i.pasoId === paso.id);
        return {
          pasoId: paso.id,
          orden: paso.orden,
          titulo: paso.titulo,
          objetivo: paso.objetivo,
          instrucciones: paso.instrucciones,
          promptIa: paso.promptIa,
          respuesta: interaccion ? interaccion.contenido : null,
          fechaRespuesta: interaccion ? interaccion.fecha : null,
        };
      }),
    });
  }
}
