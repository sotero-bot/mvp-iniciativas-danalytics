import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';

export class RegistrarRespuestaPorTokenUseCase {
  constructor(
    private readonly repository: IInstanciaRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    token: string,
    pasoId: string,
    contenido: string,
    respuestaUsuario?: string,
    respuestaIa?: string,
  ): Promise<void> {
    const instancia = await this.repository.findByAccessToken(token);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    // Domain validation: verifica que la instancia esté iniciada
    instancia.registrarRespuesta(pasoId, contenido);

    // Upsert directo preservando los 3 campos sin pasar por el repositorio
    // (el save del repo hace deleteMany+create y perdería respuestaUsuario/respuestaIa)
    await this.prisma.interaccion.upsert({
      where: { instanciaId_pasoId: { instanciaId: instancia.id, pasoId } },
      update: { contenido, respuestaUsuario, respuestaIa, updatedAt: new Date() },
      create: {
        id: randomUUID(),
        instanciaId: instancia.id,
        pasoId,
        contenido,
        respuestaUsuario,
        respuestaIa,
      },
    });
  }
}
