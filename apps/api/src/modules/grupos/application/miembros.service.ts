import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MiembroGrupo } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';

/** Reglas de negocio de los integrantes de un grupo. Los guards y el scoping por
 *  programa siguen en los controllers. */
@Injectable()
export class MiembrosGrupoService {
  constructor(private readonly prisma: PrismaService) {}

  async agregar(grupoId: string, usuarioId: string): Promise<MiembroGrupo> {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');

    // RN-04: el usuario debe ser participante activo del mismo programa.
    const participante = await this.prisma.participantePrograma.findFirst({
      where: { programaId: grupo.programaId, usuarioId, activo: true },
      select: { id: true, confirmadoEn: true },
    });
    if (!participante) throw new AppError('MIEMBRO_NO_PARTICIPA');
    // El estudiante debe haber confirmado su registro al programa antes de entrar a un grupo.
    if (!participante.confirmadoEn) throw new AppError('MIEMBRO_NO_CONFIRMADO');

    // RN-04: un estudiante en un solo grupo por programa (chequeo explícito +
    // el índice único @@unique([programaId, usuarioId]) como red de seguridad).
    const yaEnGrupo = await this.prisma.miembroGrupo.findFirst({
      where: { programaId: grupo.programaId, usuarioId },
    });
    if (yaEnGrupo) throw new AppError('MIEMBRO_YA_EN_GRUPO');

    try {
      return await this.prisma.miembroGrupo.create({
        data: {
          id: randomUUID(),
          grupoId,
          // Denormalizado a propósito (RN-04): lo usa el índice único por programa.
          programaId: grupo.programaId,
          usuarioId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('MIEMBRO_YA_EN_GRUPO');
      }
      throw e;
    }
  }

  async quitar(grupoId: string, usuarioId: string): Promise<void> {
    const miembro = await this.prisma.miembroGrupo.findFirst({ where: { grupoId, usuarioId } });
    if (!miembro) throw new AppError('MIEMBRO_NO_PARTICIPA');

    // Regla: mínimo 2 integrantes por grupo. No se puede dejar el grupo en 1;
    // si tiene exactamente 2, para quitar a alguien hay que eliminar el grupo.
    const total = await this.prisma.miembroGrupo.count({ where: { grupoId } });
    if (total === 2) throw new AppError('GRUPO_MIN_INTEGRANTES');

    await this.prisma.miembroGrupo.delete({ where: { id: miembro.id } });
  }

  /** "Quita a A, pon a B" atómico. NO evalúa GRUPO_MIN_INTEGRANTES: el conteo no baja,
   *  así que funciona también en un grupo de exactamente 2 integrantes. */
  async reemplazar(grupoId: string, salienteId: string, entranteId: string): Promise<void> {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');
    if (salienteId === entranteId) throw new AppError('GRUPO_REEMPLAZO_INVALIDO');

    const saliente = await this.prisma.miembroGrupo.findFirst({ where: { grupoId, usuarioId: salienteId } });
    if (!saliente) throw new AppError('MIEMBRO_NO_PARTICIPA');

    const participante = await this.prisma.participantePrograma.findFirst({
      where: { programaId: grupo.programaId, usuarioId: entranteId, activo: true },
      select: { id: true, confirmadoEn: true },
    });
    if (!participante) throw new AppError('MIEMBRO_NO_PARTICIPA');
    if (!participante.confirmadoEn) throw new AppError('MIEMBRO_NO_CONFIRMADO');

    const yaEnGrupo = await this.prisma.miembroGrupo.findFirst({
      where: { programaId: grupo.programaId, usuarioId: entranteId },
    });
    if (yaEnGrupo) throw new AppError('MIEMBRO_YA_EN_GRUPO');

    try {
      await this.prisma.$transaction([
        this.prisma.miembroGrupo.delete({ where: { id: saliente.id } }),
        this.prisma.miembroGrupo.create({
          data: {
            id: randomUUID(),
            grupoId,
            programaId: grupo.programaId, // denormalizado a propósito (RN-04)
            usuarioId: entranteId,
          },
        }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('MIEMBRO_YA_EN_GRUPO');
      }
      throw e;
    }
  }
}
