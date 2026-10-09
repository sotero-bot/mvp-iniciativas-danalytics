import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { ENTREGA_SELECT, entregaCompleta } from './entrega-grupo';

const GRUPO_CIERRE_SELECT = {
  id: true,
  programaId: true,
  nombre: true,
  orden: true,
  finalizadoEn: true,
  finalizadoPor: { select: { id: true, nombre: true } },
} as const;

/** HU-23: cierre de un grupo por el revisor (facilitador/admin). Los guards y el scoping
 *  por programa siguen en los controllers. Finalizar = aprobación: no hay campo aparte. */
@Injectable()
export class GrupoCierreService {
  constructor(private readonly prisma: PrismaService) {}

  /** Carga el grupo (GRUPO_NOT_FOUND) para que el controller aplique el scope antes de escribir. */
  async cargar(grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { presentacionFinal: ENTREGA_SELECT.presentacionFinal, respuestasFormulario: ENTREGA_SELECT.respuestasFormulario },
    });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');
    return grupo;
  }

  async finalizar(grupoId: string, actorId: string) {
    const grupo = await this.cargar(grupoId);
    if (grupo.finalizadoEn) throw new AppError('GRUPO_FINALIZADO');
    // Solo se finaliza lo que entregó todo en la fase 3 (la UI lo refleja, pero el servidor lo exige).
    if (!entregaCompleta(grupo)) throw new AppError('GRUPO_ENTREGA_INCOMPLETA');
    return this.prisma.grupo.update({
      where: { id: grupoId },
      data: { finalizadoEn: new Date(), finalizadoPorId: actorId },
      select: GRUPO_CIERRE_SELECT,
    });
  }

  async reabrir(grupoId: string) {
    const grupo = await this.cargar(grupoId);
    if (!grupo.finalizadoEn) throw new AppError('GRUPO_NO_FINALIZADO');
    return this.prisma.grupo.update({
      where: { id: grupoId },
      data: { finalizadoEn: null, finalizadoPorId: null },
      select: GRUPO_CIERRE_SELECT,
    });
  }
}
