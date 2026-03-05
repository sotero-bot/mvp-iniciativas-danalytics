import { IEnlaceActividadRepository } from '../domain/IEnlaceActividadRepository';
import { EnlaceActividad } from '../domain/EnlaceActividad';

export class GenerarEnlaceActividadUseCase {
    constructor(private readonly repo: IEnlaceActividadRepository) { }

    async execute(actividadId: string, nombre?: string): Promise<EnlaceActividad> {
        const enlace = EnlaceActividad.crear(actividadId, nombre);
        await this.repo.save(enlace);
        return enlace;
    }
}
