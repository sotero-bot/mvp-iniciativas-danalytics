
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { InstanciaActividad } from '../domain/InstanciaActividad';

export class AccederInstanciaPorTokenUseCase {
  constructor(private readonly repository: IInstanciaRepository) {}

  async execute(token: string): Promise<InstanciaActividad> {
    const instancia = await this.repository.findByAccessToken(token);
    
    if (!instancia) {
      // Importante: No revelar si el token es inválido o expirado por seguridad, 
      // pero para MVP 404 está bien.
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    return instancia;
  }
}
