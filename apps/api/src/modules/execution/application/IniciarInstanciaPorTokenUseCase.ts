import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';

export class IniciarInstanciaPorTokenUseCase {
  constructor(private readonly repository: IInstanciaRepository) {}

  async execute(token: string): Promise<Date> {
    const instancia = await this.repository.findByAccessToken(token);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    instancia.iniciar();
    await this.repository.save(instancia);
    
    return instancia.fechaInicio!;
  }
}
