import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';

export class AsignarUsuarioPorTokenUseCase {
  constructor(
    private readonly repository: IInstanciaRepository,
    private readonly prisma: PrismaService // Necesario para crear el Usuario directamente
  ) { }

  async execute(token: string, input: { nombre: string; email?: string; cargo?: string }): Promise<void> {
    const instancia = await this.repository.findByAccessToken(token);

    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    // 1. Obtener la actividad para saber a qué empresa pertenece (para crear el usuario)
    // En un sistema más complejo esto iría vía un servicio de dominio u otro repo
    const actividad = await this.prisma.actividad.findUnique({
      where: { id: instancia.actividadId },
      include: { iniciativa: true }
    });

    if (!actividad) {
      throw new ResourceNotFoundError('Actividad', instancia.actividadId);
    }

    // 2. Crear Usuario
    const nuevoUsuario = await this.prisma.usuario.create({
      data: {
        id: randomUUID(),
        nombre: input.nombre,
        email: input.email,
        cargo: input.cargo,
        empresaId: actividad.iniciativa.empresaId
      }
    });

    // 3. Asignar a la instancia (Dominio aplica reglas)
    instancia.asignarUsuario(nuevoUsuario.id);

    // 4. Persistir instancia
    await this.repository.save(instancia);
  }
}
