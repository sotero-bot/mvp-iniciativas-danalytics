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
    contenidoArchivo?: string,
    preguntaId?: string,
    archivoKey?: string,
  ): Promise<void> {
    const instancia = await this.repository.findByAccessToken(token);
    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    instancia.registrarRespuesta(pasoId, contenido);

    if (preguntaId) {
      await this.prisma.respuesta.upsert({
        where: { instanciaId_preguntaId: { instanciaId: instancia.id, preguntaId } },
        update: { contenido, respuestaUsuario, respuestaIa, archivoNombre, contenidoArchivo, archivoKey, updatedAt: new Date() },
        create: {
          id: randomUUID(),
          instanciaId: instancia.id,
          preguntaId,
          contenido,
          respuestaUsuario,
          respuestaIa,
          archivoNombre,
          contenidoArchivo,
          archivoKey,
        },
      });
    } else {
      // Legacy: paso sin preguntas (compat con instancias anteriores al REQ-07)
      await this.prisma.interaccion.upsert({
        where: { instanciaId_pasoId: { instanciaId: instancia.id, pasoId } },
        update: { contenido, respuestaUsuario, respuestaIa, archivoNombre, contenidoArchivo, updatedAt: new Date() },
        create: {
          id: randomUUID(),
          instanciaId: instancia.id,
          pasoId,
          contenido,
          respuestaUsuario,
          respuestaIa,
          archivoNombre,
          contenidoArchivo,
        },
      });
    }
  }
}
