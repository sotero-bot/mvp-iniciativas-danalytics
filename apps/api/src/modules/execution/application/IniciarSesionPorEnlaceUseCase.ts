import { IEnlaceActividadRepository } from '../domain/IEnlaceActividadRepository';
import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { InstanciaActividad } from '../domain/InstanciaActividad';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { BusinessRuleViolationError } from '../../../shared/domain/DomainError';
import { randomUUID } from 'crypto';

export interface SesionResult {
    instanceToken: string;
}

export class IniciarSesionPorEnlaceUseCase {
    constructor(
        private readonly enlaceRepo: IEnlaceActividadRepository,
        private readonly instanciaRepo: IInstanciaRepository
    ) { }

    async execute(enlaceToken: string): Promise<SesionResult> {
        const enlace = await this.enlaceRepo.findByToken(enlaceToken);
        if (!enlace) throw new ResourceNotFoundError('EnlaceActividad', enlaceToken);
        if (!enlace.activo) throw new BusinessRuleViolationError('Este enlace ha sido desactivado.');

        // Crear una nueva instancia para esta sesión
        const instancia = InstanciaActividad.crear(randomUUID(), enlace.actividadId, undefined, undefined);
        await this.instanciaRepo.save(instancia);

        return { instanceToken: instancia.accessToken };
    }
}
