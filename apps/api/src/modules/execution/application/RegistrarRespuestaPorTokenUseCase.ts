import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

export class RegistrarRespuestaPorTokenUseCase {
  constructor(private readonly repository: IInstanciaRepository) {}

  async execute(token: string, pasoId: string, contenido: string): Promise<void> {
    const instancia = await this.repository.findByAccessToken(token);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    instancia.registrarRespuesta(pasoId, contenido);
    await this.repository.save(instancia);
  }
}
