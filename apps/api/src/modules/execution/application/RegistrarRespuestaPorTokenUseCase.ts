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
    archivoNombre?: string,
    archivoContenido?: Buffer,
  ): Promise<void> {
    const instancia = await this.repository.findByAccessToken(token);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    instancia.registrarRespuesta(pasoId, contenido);

    await this.prisma.interaccion.upsert({
      where: { instanciaId_pasoId: { instanciaId: instancia.id, pasoId } },
      update: {
        contenido, respuestaUsuario, respuestaIa, archivoNombre, updatedAt: new Date(),
        ...(archivoContenido ? { archivoContenido } : {}),
      },
      create: {
        id: randomUUID(),
        instanciaId: instancia.id,
        pasoId,
        contenido,
        respuestaUsuario,
        respuestaIa,
        archivoNombre,
        ...(archivoContenido ? { archivoContenido } : {}),
      },
    });
  }
}
