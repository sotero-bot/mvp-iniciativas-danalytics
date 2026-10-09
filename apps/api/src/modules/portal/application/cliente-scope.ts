import type { Prisma } from '@prisma/client';

import type { PrismaService } from '../../../prisma.service';
import type { AuthUser } from '../../auth/guards';
import { AppError } from '../../../shared/errors/AppError';

/** C-07: cliente_admin ve todos los programas de su empresa;
 *  usuario_cliente solo los asignados vía UsuarioClientePrograma. */
export function programasClienteScope(actor: AuthUser): Prisma.ProgramaWhereInput {
  if (!actor.empresaId) throw new AppError('PORTAL_ACCESO_DENEGADO');
  const empresaId = actor.empresaId;
  if (actor.role === 'usuario_cliente') {
    return { empresaId, asignacionesCliente: { some: { usuarioId: actor.sub } } };
  }
  return { empresaId };
}

/** RN-09: inexistente / de otra empresa / no asignado → el MISMO error.
 *  No filtra existencia. */
export async function assertProgramaCliente(
  prisma: PrismaService,
  actor: AuthUser,
  programaId: string,
): Promise<void> {
  const programa = await prisma.programa.findFirst({
    where: { AND: [{ id: programaId }, programasClienteScope(actor)] },
    select: { id: true },
  });
  if (!programa) throw new AppError('PORTAL_ACCESO_DENEGADO');
}
