import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';

type Tx = Prisma.TransactionClient;

/**
 * Snapshot automático de plantillas de formulario por programa
 * (Plan 2 §2.2 — RF-46/47/48/49, RN-10).
 *
 * Al activar un programa (`borrador → activo`, ver AdminProgramasController) se copia
 * cada template global activo (`programaId = null`) con sus campos, creando plantillas
 * con `programaId = programa` y `snapshotDeId` apuntando al global de origen. Editar el
 * global después NO afecta a programas ya activados (RF-48): son filas independientes.
 */
@Injectable()
export class SnapshotFormulariosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * RF-46: crea el snapshot del programa copiando los globales activos.
   * Idempotente por tipo: si el programa ya tiene un snapshot de un template, no lo duplica.
   */
  async snapshotPrograma(programaId: string, creadoPorId?: string | null): Promise<number> {
    return this.prisma.$transaction(async (tx) => this.copiarGlobales(tx, programaId, creadoPorId ?? null));
  }

  /**
   * RF-47: regenera el snapshot SOLO si no hay ninguna respuesta registrada sobre
   * las plantillas del programa; con ≥1 respuesta el snapshot es inmutable.
   */
  async regenerarSnapshot(programaId: string, creadoPorId?: string | null): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const respuestas = await tx.respuestaFormulario.count({
        where: { plantilla: { programaId } },
      });
      if (respuestas > 0) throw new AppError('SNAPSHOT_CON_RESPUESTAS');

      await tx.plantillaFormulario.deleteMany({ where: { programaId } });
      return this.copiarGlobales(tx, programaId, creadoPorId ?? null);
    });
  }

  /**
   * RF-49: estado del snapshot por plantilla — fecha de snapshot (`createdAt`) y si el
   * global de origen cambió después (`desactualizado`, indicador informativo, no error).
   */
  async estadoSnapshot(programaId: string) {
    const snapshots = await this.prisma.plantillaFormulario.findMany({
      where: { programaId },
      select: {
        id: true,
        tipoFormulario: true,
        nombre: true,
        version: true,
        createdAt: true,
        snapshotDeId: true,
        snapshotDe: { select: { id: true, updatedAt: true, activa: true } },
        _count: { select: { respuestas: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return snapshots.map(s => ({
      id: s.id,
      tipoFormulario: s.tipoFormulario,
      nombre: s.nombre,
      version: s.version,
      snapshotEn: s.createdAt,
      respuestas: s._count.respuestas,
      // RF-49: el global cambió después de tomar el snapshot → "versión anterior".
      desactualizado: !!s.snapshotDe && s.snapshotDe.updatedAt.getTime() > s.createdAt.getTime(),
    }));
  }

  private async copiarGlobales(tx: Tx, programaId: string, creadoPorId: string | null): Promise<number> {
    const globales = await tx.plantillaFormulario.findMany({
      where: { programaId: null, activa: true },
      include: { campos: { orderBy: { orden: 'asc' } } },
    });

    // Idempotencia: no duplicar snapshots ya tomados de un mismo global.
    const existentes = await tx.plantillaFormulario.findMany({
      where: { programaId, snapshotDeId: { in: globales.map(g => g.id) } },
      select: { snapshotDeId: true },
    });
    const yaCopiados = new Set(existentes.map(e => e.snapshotDeId));

    let creados = 0;
    for (const global of globales) {
      if (yaCopiados.has(global.id)) continue;

      const snapshot = await tx.plantillaFormulario.create({
        data: {
          id: randomUUID(),
          programaId,
          tipoFormulario: global.tipoFormulario,
          nombre: global.nombre,
          descripcion: global.descripcion,
          version: global.version,
          activa: true,
          snapshotDeId: global.id,
          creadoPorId,
        },
      });

      // Copia de campos preservando la jerarquía campoPadreId (grupo_repetible).
      const idMap = new Map<string, string>();
      for (const campo of global.campos) idMap.set(campo.id, randomUUID());
      for (const campo of global.campos) {
        await tx.campoFormulario.create({
          data: {
            id: idMap.get(campo.id)!,
            plantillaId: snapshot.id,
            campoPadreId: campo.campoPadreId ? idMap.get(campo.campoPadreId) ?? null : null,
            tipoCampo: campo.tipoCampo,
            etiqueta: campo.etiqueta,
            descripcion: campo.descripcion,
            dimension: campo.dimension,
            esObligatorio: campo.esObligatorio,
            orden: campo.orden,
            configJson: campo.configJson as Prisma.InputJsonValue,
          },
        });
      }
      creados++;
    }
    return creados;
  }
}
