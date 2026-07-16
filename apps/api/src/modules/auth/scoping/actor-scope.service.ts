import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppError } from '../../../shared/errors/AppError';
import { addBusinessDays } from '../../../shared/utils/businessDays';
import { AuthUser } from '../guards/auth-user';

type ProgramaAccesoRow = {
  id: string;
  estado: string;
  fechaFin: Date | null;
  diasGracia: number;
};

/**
 * Scoping por actor (Plan 2 §0.1, RNF-02 / RN-09).
 *
 * Primitivo transversal: traduce el `AuthUser` del JWT en fragmentos `WHERE`
 * de Prisma que los servicios de cada fase combinan con sus propias consultas.
 * Centraliza la regla de visibilidad para que ningún endpoint dependa del
 * frontend y para que la lógica viva en un único sitio auditable.
 *
 *   - `danalytics_admin` → sin filtro.
 *   - `facilitador`      → solo programas donde está asignado (N:M ProgramaFacilitador, C-01).
 *   - `estudiante`       → solo programas con `ParticipantePrograma` activo del actor.
 *   - `cliente_admin`    → `empresaId = jwt.empresaId` (RN-09, ve todos los de su empresa).
 *   - `usuario_cliente`  → `empresaId` + solo programas asignados (N:M UsuarioClientePrograma, C-07).
 *
 * La ENFORCEMENT en cada endpoint (Fase 1+) hace `WHERE: { ...scope, ...filtros }`.
 */
@Injectable()
export class ActorScopeService {
  /**
   * Fragmento `WHERE` para la tabla `Programa` según el actor.
   * Combinar con `AND`/spread en la consulta del servicio.
   */
  programaScope(actor: AuthUser): Prisma.ProgramaWhereInput {
    switch (actor.role) {
      case 'danalytics_admin':
        return {};
      case 'facilitador':
        // C-01: N:M — el facilitador ve los programas donde está asignado.
        return { facilitadores: { some: { usuarioId: actor.sub } } };
      case 'estudiante':
        return { participantes: { some: { usuarioId: actor.sub, activo: true } } };
      case 'cliente_admin':
        return { empresaId: this.requireEmpresa(actor) };
      case 'usuario_cliente':
        // C-07: además de su empresa, solo los programas explícitamente asignados.
        return {
          empresaId: this.requireEmpresa(actor),
          asignacionesCliente: { some: { usuarioId: actor.sub } },
        };
      default:
        // Rol desconocido o ausente: no ve nada.
        throw new AppError('FORBIDDEN');
    }
  }

  /**
   * Fragmento `WHERE` para tablas con columna `empresaId` (portal cliente, RN-09).
   * `danalytics_admin` no se filtra; el resto queda acotado a su empresa.
   */
  empresaScope(actor: AuthUser): { empresaId?: string } {
    if (actor.role === 'danalytics_admin') return {};
    return { empresaId: this.requireEmpresa(actor) };
  }

  /**
   * Verifica que el actor puede acceder a un `Programa` concreto; si no, 403.
   * Resuelve el scope contra la BD (una sola query por `id` + filtro de actor).
   *
   * RF-03/RN-03: si el actor es `facilitador` y el programa está `finalizado` con
   * el plazo de gracia (días hábiles) ya vencido, también es 403 — así se revoca
   * el acceso del facilitador sin necesitar un cron.
   */
  async assertProgramaAccessible(
    prisma: { programa: { findFirst: (args: unknown) => Promise<ProgramaAccesoRow | null> } },
    actor: AuthUser,
    programaId: string,
  ): Promise<void> {
    const found = await prisma.programa.findFirst({
      where: { AND: [{ id: programaId }, this.programaScope(actor)] },
      select: { id: true, estado: true, fechaFin: true, diasGracia: true },
    });
    if (!found) throw new AppError('FORBIDDEN');
    if (actor.role === 'facilitador' && found.estado === 'finalizado' && found.fechaFin) {
      const vigenteHasta = addBusinessDays(found.fechaFin, found.diasGracia);
      if (vigenteHasta.getTime() < Date.now()) {
        throw new AppError('FORBIDDEN');
      }
    }
  }

  private requireEmpresa(actor: AuthUser): string {
    if (!actor.empresaId) throw new AppError('FORBIDDEN');
    return actor.empresaId;
  }
}
