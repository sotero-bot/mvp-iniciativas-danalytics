import { IInstanciaRepository } from '../../domain/IInstanciaRepository';
import { InstanciaActividad } from '../../domain/InstanciaActividad';
import { InstanciaMapper } from './InstanciaMapper';
import { PrismaClientMock } from '../../../../shared/infrastructure/prisma-types';

export class PrismaInstanciaRepository implements IInstanciaRepository {
  constructor(private readonly prisma: PrismaClientMock) {}

  async findById(id: string): Promise<InstanciaActividad | null> {
    const raw = await this.prisma.instanciaActividad.findUnique({
      where: { id },
      include: { interacciones: true },
    });

    if (!raw) return null;

    return InstanciaMapper.toDomain(raw);
  }

  async findByIdWithRelations(id: string): Promise<any | null> {
    return await this.prisma.instanciaActividad.findUnique({
      where: { id },
      include: {
        actividad: {
          include: {
            pasos: {
              orderBy: { orden: 'asc' }
            }
          }
        },
        usuario: true,
        interacciones: true,
      },
    });
  }

  async findByUsuario(usuarioId: string): Promise<InstanciaActividad[]> {
    const rawList = await this.prisma.instanciaActividad.findMany({
      where: { usuarioId },
      include: { interacciones: true },
    });

    return rawList.map((raw: any) => InstanciaMapper.toDomain(raw));
  }

  async findByAccessToken(token: string): Promise<InstanciaActividad | null> {
    const raw = await this.prisma.instanciaActividad.findUnique({
      where: { accessToken: token },
      include: { interacciones: true },
    });

    if (!raw) return null;

    return InstanciaMapper.toDomain(raw);
  }

  async save(instancia: InstanciaActividad): Promise<void> {
    const data = InstanciaMapper.toPersistence(instancia);

    // Transacción implícita usando upsert
    // Nota: Para las interacciones, Prisma maneja la relación si está configurada como nested write.
    // Aquí simplificamos asumiendo un upsert plano o delete-insert logic si fuera necesario.
    // Para MVP, upsert del root y manejo de interacciones.
    
    await this.prisma.instanciaActividad.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        actividadId: data.actividadId,
        usuarioId: data.usuarioId,
        accessToken: data.accessToken,
        estado: data.estado,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        emailReferencia: data.emailReferencia,
        interacciones: {
          create: data.interacciones.map(i => ({
             pasoId: i.pasoId,
             contenido: i.contenido,
             fecha: i.fecha
          }))
        }
      },
      update: {
        usuarioId: data.usuarioId,
        estado: data.estado,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        emailReferencia: data.emailReferencia,
        // Estrategia simplificada: Borrar e insertar interacciones para actualización completa
        // O usar updateMany si se tienen IDs. Como son VOs mutables, deleteMany + create es seguro en transacción.
        interacciones: {
          deleteMany: {},
          create: data.interacciones.map(i => ({
             pasoId: i.pasoId,
             contenido: i.contenido,
             fecha: i.fecha
          }))
        }
      },
    });
  }
}
