import { IPasoActividadRepository } from '../domain/IPasoActividadRepository';
import { PasoActividad } from '../domain/PasoActividad';
import { IActividadRepository } from '../domain/Actividad';
import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { randomUUID } from 'crypto';

export interface AgregarPasoInput {
  actividadId: string;
  titulo: string;
  orden: number;
  usarIa?: boolean;
  objetivo?: string;
  instrucciones?: string;
  promptIa?: string;
}

export class AgregarPasoActividadUseCase {
  constructor(
    private readonly actividadRepo: IActividadRepository,
    private readonly pasoRepo: IPasoActividadRepository
  ) { }

  async execute(input: AgregarPasoInput): Promise<PasoActividad> {
    // 1) Verificar que la Actividad exista
    const actividad = await this.actividadRepo.findById(input.actividadId);
    if (!actividad) {
      throw new ResourceNotFoundError('Actividad', input.actividadId);
    }

    // 2) Verificar que Actividad.estado === "inactiva"
    if (actividad.estado !== 'inactiva') {
      throw new BusinessRuleViolationError(
        `No se pueden agregar pasos a una actividad en estado '${actividad.estado}'. Solo se permite en estado 'inactiva'.`
      );
    }

    // 3) Verificar que NO exista otro paso con mismo orden
    const existeOrden = await this.pasoRepo.existsByActividadIdAndOrden(
      input.actividadId,
      input.orden
    );
    if (existeOrden) {
      throw new BusinessRuleViolationError(
        `Ya existe un paso con el orden ${input.orden} en esta actividad.`
      );
    }

    // 4) Si todo es válido → crear paso
    const nuevoPaso = new PasoActividad(
      randomUUID(),
      input.actividadId,
      input.titulo,
      input.orden,
      input.usarIa ?? false,
      input.objetivo,
      input.instrucciones,
      input.usarIa ? input.promptIa : undefined
    );

    await this.pasoRepo.create(nuevoPaso);

    return nuevoPaso;
  }
}
