import { IInstanciaRepository } from '../domain/IInstanciaRepository';
import { ResourceNotFoundError } from '../../../shared/domain/ResourceNotFoundError';
import { PrismaService } from '../../../prisma.service';
import { randomUUID } from 'crypto';

export interface IdentificarResult {
  usuarioId: string;
  reutilizado: boolean;
  nombre: string;
  instanceToken: string; // token a usar de aquí en adelante (puede ser el mismo o el de una sesión previa)
}

export class AsignarUsuarioPorTokenUseCase {
  constructor(
    private readonly repository: IInstanciaRepository,
    private readonly prisma: PrismaService
  ) { }

  async execute(token: string, input: { nombre: string; email: string; cargo?: string; area?: string }): Promise<IdentificarResult> {
    const instancia = await this.repository.findByAccessToken(token);

    if (!instancia) {
      throw new ResourceNotFoundError('InstanciaActividad', token);
    }

    const actividad = await this.prisma.actividad.findUnique({
      where: { id: instancia.actividadId },
      include: { iniciativa: true }
    });

    if (!actividad) {
      throw new ResourceNotFoundError('Actividad', instancia.actividadId);
    }

    const empresaId = actividad.iniciativa.empresaId;
    const emailNormalizado = input.email.toLowerCase().trim();

    // Buscar usuario existente por (empresaId, email)
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { empresa_email_unico: { empresaId, email: emailNormalizado } }
    });

    let usuario: { id: string; nombre: string };
    let reutilizado: boolean;

    if (usuarioExistente) {
      usuario = usuarioExistente;
      reutilizado = true;
    } else {
      usuario = await this.prisma.usuario.create({
        data: {
          id: randomUUID(),
          nombre: input.nombre,
          email: emailNormalizado,
          cargo: input.cargo,
          area: input.area,
          empresaId
        }
      });
      reutilizado = false;
    }

    // Si el usuario ya tiene una instancia previa para esta actividad, retomar esa.
    // La instancia actual (recién creada y vacía) se cancela.
    if (reutilizado) {
      const instanciaPrevia = await this.prisma.instanciaActividad.findFirst({
        where: {
          actividadId: actividad.id,
          usuarioId: usuario.id,
          estado: { not: 'cancelado' },
          id: { not: instancia.id },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (instanciaPrevia) {
        // Cancelar la instancia vacía recién creada
        await this.prisma.instanciaActividad.update({
          where: { id: instancia.id },
          data: { estado: 'cancelado', activo: false },
        });
        return { usuarioId: usuario.id, reutilizado: true, nombre: usuario.nombre, instanceToken: instanciaPrevia.accessToken };
      }
    }

    instancia.asignarUsuario(usuario.id);
    await this.repository.save(instancia);

    return { usuarioId: usuario.id, reutilizado, nombre: usuario.nombre, instanceToken: instancia.accessToken };
  }
}
