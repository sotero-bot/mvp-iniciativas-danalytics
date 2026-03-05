import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { InstanciaActividad } from '../domain/InstanciaActividad';
import { randomUUID } from 'crypto';

export interface GenerarInstanciaResult {
  id: string;
  accessToken: string;
}

export class GenerarInstanciaUseCase {
  constructor(private readonly repository: IInstanciaRepository) { }

  async execute(actividadId: string, emailReferencia?: string): Promise<GenerarInstanciaResult> {
    // 1. Generar ID único
    const id = randomUUID();

    // 2. Crear Aggregate usando Factory
    const instancia = InstanciaActividad.crear(id, actividadId, undefined, emailReferencia);

    // 3. Persistir
    await this.repository.save(instancia);

    return { id, accessToken: instancia.accessToken };
  }
}
