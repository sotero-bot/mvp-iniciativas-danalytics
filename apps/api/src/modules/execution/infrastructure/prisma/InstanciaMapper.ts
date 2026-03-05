import { InstanciaActividad, InstanciaEstado } from '../../domain/InstanciaActividad';

// Tipos aproximados del modelo de BD (generados por Prisma)
type PrismaInstancia = {
  id: string;
  actividadId: string;
  usuarioId: string | null;
  accessToken: string;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  interacciones: PrismaInteraccion[];
  emailReferencia: string | null;
};

type PrismaInteraccion = {
  pasoId: string;
  contenido: string;
  fecha: Date;
};

export class InstanciaMapper {
  static toDomain(raw: PrismaInstancia): InstanciaActividad {
    // Mapeo de string a Enum de Dominio
    // Validamos que el string de BD sea un estado válido, si no, fallback o error.
    const estado = Object.values(InstanciaEstado).includes(raw.estado as InstanciaEstado)
      ? (raw.estado as InstanciaEstado)
      : InstanciaEstado.GENERADO; // Fallback seguro o lanzar error de integridad

    return InstanciaActividad.reconstituir(
      raw.id,
      raw.actividadId,
      raw.usuarioId || undefined,
      raw.accessToken,
      estado,
      raw.fechaInicio ?? undefined,
      raw.fechaFin ?? undefined,
      raw.interacciones.map((i) => ({
        pasoId: i.pasoId,
        contenido: i.contenido,
        fecha: i.fecha,
      })),
      raw.emailReferencia || undefined
    );
  }

  static toPersistence(domain: InstanciaActividad) {
    return {
      id: domain.id,
      actividadId: domain.actividadId,
      usuarioId: domain.usuarioId,
      accessToken: domain.accessToken,
      estado: domain.estado,
      fechaInicio: domain.fechaInicio || null,
      fechaFin: domain.fechaFin || null,
      emailReferencia: domain.emailReferencia || null,
      interacciones: domain.interacciones.map((i) => ({
        instanciaId: domain.id, // FK
        pasoId: i.pasoId,
        contenido: i.contenido,
        fecha: i.fecha,
      })),
    };
  }
}
