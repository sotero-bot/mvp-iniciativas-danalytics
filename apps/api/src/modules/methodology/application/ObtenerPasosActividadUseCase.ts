import { IPasoActividadRepository } from '../domain/IPasoActividadRepository';
import { PasoActividad } from '../domain/PasoActividad';
import { IActividadRepository } from '../domain/Actividad';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

export class ObtenerPasosActividadUseCase {
  constructor(
    private readonly actividadRepo: IActividadRepository,
    private readonly pasoRepo: IPasoActividadRepository
  ) {}

  async execute(actividadId: string): Promise<PasoActividad[]> {
    // 1) Verificar que la Actividad exista
    const actividad = await this.actividadRepo.findById(actividadId);
    if (!actividad) {
      throw new ResourceNotFoundError('Actividad', actividadId);
    }

    // 2) Obtener los pasos (el ordenamiento se hace en el repositorio)
    return this.pasoRepo.findByActividadId(actividadId);
  }
}
