import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

export class IniciarInstanciaUseCase {
  constructor(private readonly repository: IInstanciaRepository) {}

  async execute(instanciaId: string): Promise<void> {
    // 1. Recuperar Aggregate
    const instancia = await this.repository.findById(instanciaId);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', instanciaId);
    }

    // 2. Ejecutar comportamiento de dominio (Transición de Estado)
    instancia.iniciar();

    // 3. Persistir cambios
    await this.repository.save(instancia);
  }
}
