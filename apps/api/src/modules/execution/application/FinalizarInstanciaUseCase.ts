import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

export class FinalizarInstanciaUseCase {
  constructor(private readonly repository: IInstanciaRepository) {}

  async execute(instanciaId: string): Promise<void> {
    // 1. Recuperar Aggregate
    const instancia = await this.repository.findById(instanciaId);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', instanciaId);
    }

    // 2. Ejecutar comportamiento de dominio (Transición Final)
    instancia.finalizar();

    // 3. Persistir cambios
    await this.repository.save(instancia);
    
    // NOTA: Aquí se podría disparar un Evento de Dominio "InstanciaFinalizada"
    // para que el módulo de Producto genere el PDF asíncronamente.
  }
}
