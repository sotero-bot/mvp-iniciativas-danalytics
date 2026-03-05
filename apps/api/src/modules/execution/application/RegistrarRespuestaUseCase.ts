import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

export class RegistrarRespuestaUseCase {
  constructor(private readonly repository: IInstanciaRepository) {}

  async execute(instanciaId: string, pasoId: string, contenido: string): Promise<void> {
    // 1. Recuperar Aggregate
    const instancia = await this.repository.findById(instanciaId);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', instanciaId);
    }

    // 2. Delegar al dominio la lógica de registro (validación de estado, etc.)
    instancia.registrarRespuesta(pasoId, contenido);

    // 3. Persistir cambios
    await this.repository.save(instancia);
  }
}
