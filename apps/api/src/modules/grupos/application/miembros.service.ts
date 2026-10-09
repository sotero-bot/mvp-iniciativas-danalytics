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

    // HU-21/22: sin mínimo de integrantes. Un grupo puede quedar con 1 (o 0) mientras se
    // reorganiza; la UI solo avisa con una advertencia.
    await this.prisma.miembroGrupo.delete({ where: { id: miembro.id } });
  }

  /** "Quita a A, pon a B" atómico: el conteo del grupo no cambia. */
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

  /** Pasa a un integrante a otro grupo del MISMO programa. Sin mínimo de integrantes:
   *  el grupo de origen puede quedar con 1 o 0. El programaId (RN-04) no cambia. */
  async mover(grupoId: string, usuarioId: string, destinoGrupoId: string): Promise<void> {
    const [origen, destino] = await Promise.all([
      this.prisma.grupo.findUnique({ where: { id: grupoId } }),
      this.prisma.grupo.findUnique({ where: { id: destinoGrupoId } }),
    ]);
    if (!origen || !destino) throw new AppError('GRUPO_NOT_FOUND');
    if (origen.id === destino.id || origen.programaId !== destino.programaId) {
      throw new AppError('GRUPO_MOVER_INVALIDO');
    }

    const miembro = await this.prisma.miembroGrupo.findFirst({ where: { grupoId, usuarioId } });
    if (!miembro) throw new AppError('MIEMBRO_NO_PARTICIPA');

    await this.prisma.miembroGrupo.update({ where: { id: miembro.id }, data: { grupoId: destinoGrupoId } });
  }

  /** Intercambia a dos integrantes de dos grupos distintos del mismo programa, en una
   *  transacción. `usuarioId` está en `grupoId`; `conUsuarioId` en otro grupo del programa. */
  async intercambiar(grupoId: string, usuarioId: string, conUsuarioId: string): Promise<void> {
    const grupo = await this.prisma.grupo.findUnique({ where: { id: grupoId } });
    if (!grupo) throw new AppError('GRUPO_NOT_FOUND');
    if (usuarioId === conUsuarioId) throw new AppError('GRUPO_MOVER_INVALIDO');

    const a = await this.prisma.miembroGrupo.findFirst({ where: { grupoId, usuarioId } });
    if (!a) throw new AppError('MIEMBRO_NO_PARTICIPA');
    const b = await this.prisma.miembroGrupo.findFirst({
      where: { programaId: grupo.programaId, usuarioId: conUsuarioId },
    });
    if (!b) throw new AppError('MIEMBRO_NO_PARTICIPA');
    if (b.grupoId === grupoId) throw new AppError('GRUPO_MOVER_INVALIDO');

    await this.prisma.$transaction([
      this.prisma.miembroGrupo.update({ where: { id: a.id }, data: { grupoId: b.grupoId } }),
      this.prisma.miembroGrupo.update({ where: { id: b.id }, data: { grupoId } }),
    ]);
  }
}
