import { IEnlaceActividadRepository } from '../../domain/IEnlaceActividadRepository';
import { EnlaceActividad } from '../../domain/EnlaceActividad';
import { PrismaService } from '../../../../prisma.service';

export class PrismaEnlaceActividadRepository implements IEnlaceActividadRepository {
    constructor(private readonly prisma: PrismaService) { }

    async save(enlace: EnlaceActividad): Promise<void> {
        await this.prisma.enlaceActividad.create({
            data: {
                id: enlace.id,
                actividadId: enlace.actividadId,
                accessToken: enlace.accessToken,
                nombre: enlace.nombre,
                activo: enlace.activo,
            },
        });
    }

    async findByToken(token: string): Promise<EnlaceActividad | null> {
        const raw = await this.prisma.enlaceActividad.findUnique({
            where: { accessToken: token },
        });
        if (!raw) return null;
        return new EnlaceActividad(raw.id, raw.actividadId, raw.accessToken, raw.nombre ?? undefined, raw.activo, raw.createdAt);
    }

    async findAll(): Promise<EnlaceActividad[]> {
        const raws = await this.prisma.enlaceActividad.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return raws.map(r => new EnlaceActividad(r.id, r.actividadId, r.accessToken, r.nombre ?? undefined, r.activo, r.createdAt));
    }
}
