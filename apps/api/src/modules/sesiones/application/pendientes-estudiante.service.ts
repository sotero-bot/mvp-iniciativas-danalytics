import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma.service';
import { ActorScopeService } from '../../auth/scoping/actor-scope.service';
import type { AuthUser } from '../../auth/guards';

// Pendientes ITEMIZADOS y atribuidos a su programa (o global, para la encuesta de
// inicio) para que el frontend enlace a la acción real de cada uno, no a un listado
// genérico. `tipo` gobierna el destino; `plantillaId`/`programaId` lo parametrizan.
// HU-13: `sesiones` son las sesiones del programa a las que está ligado el formulario (N:M);
// vacío si no pertenece a ninguna.
export type Pendiente = {
  tipo: 'encuesta_inicio' | 'matricula' | 'entregable' | 'formulario';
  plantillaId: string | null;
  programaId: string | null;
  programaNombre: string | null;
  nombre: string | null;
  sesiones: { numeroSesion: number; titulo: string; fechaProgramada: Date }[];
};

export interface PendientesAgrupados {
  total: number;
  porSesion: {
    numeroSesion: number;
    titulo: string;
    fechaProgramada: Date;
    realizada: boolean;
    items: Pendiente[];
  }[];
  generales: Pendiente[];
}

const enviado = (rs: { estado: string }[]) => rs.some((r) => r.estado === 'submitted');

@Injectable()
export class PendientesEstudianteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ActorScopeService,
  ) {}

  /** Lista plana de pendientes del estudiante, en todos sus programas (`/estudiante/resumen`). */
  async listar(actor: AuthUser): Promise<Pendiente[]> {
    const [programas, plantillas, matriculasPendientes] = await Promise.all([
      this.prisma.programa.findMany({
        where: this.scope.programaScope(actor),
        select: {
          id: true,
          nombre: true,
          bitacoraHabilitadaEn: true,
          grupos: {
            where: { miembros: { some: { usuarioId: actor.sub } } },
            select: { presentacionFinal: { select: { entregadoEn: true } }, finalizadoEn: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Formularios individuales del estudiante (misma lógica que /formularios/disponibles):
      // la encuesta de inicio es la plantilla GLOBAL (programaId=null); el resto son de programa.
      this.prisma.plantillaFormulario.findMany({
        where: {
          activa: true,
          tipoFormulario: { in: ['diagnostico_inicial', 'diagnostico_final', 'feedback'] },
          OR: [
            { programaId: null, tipoFormulario: 'diagnostico_inicial' },
            { programa: { is: { AND: [{ estado: 'activo' }, this.scope.programaScope(actor)] } } },
          ],
        },
        select: {
          id: true,
          nombre: true,
          programaId: true,
          tipoFormulario: true,
          sesiones: { select: { sesion: { select: { numeroSesion: true, titulo: true, fechaProgramada: true } } } },
          programa: { select: { id: true, nombre: true } },
          respuestas: { where: { usuarioRespondienteId: actor.sub }, select: { estado: true } },
        },
      }),
      this.prisma.participantePrograma.findMany({
        where: { usuarioId: actor.sub, activo: true, confirmadoEn: null },
        select: { programa: { select: { id: true, nombre: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const pendientes: Pendiente[] = [];

    // 1) Encuesta de inicio (gate global, sin programa). Deep-link al formulario.
    const encuesta = plantillas.find(
      (p) => p.programaId === null && p.tipoFormulario === 'diagnostico_inicial',
    );
    if (encuesta && !enviado(encuesta.respuestas)) {
      pendientes.push({
        tipo: 'encuesta_inicio',
        plantillaId: encuesta.id,
        programaId: null,
        programaNombre: null,
        nombre: encuesta.nombre,
        sesiones: [],
      });
    }

    // 2) Matrículas por confirmar (programas fuera de scope hasta confirmar).
    for (const m of matriculasPendientes) {
      pendientes.push({
        tipo: 'matricula',
        plantillaId: null,
        programaId: m.programa.id,
        programaNombre: m.programa.nombre,
        nombre: null,
        sesiones: [],
      });
    }

    // 3) Entregables del reto: un grupo con el reto habilitado (bitácora habilitada) y sin
    // presentación final entregada ni cierre (HU-23) aporta un entregable atribuido al programa.
    for (const p of programas) {
      const grupo = p.grupos[0] ?? null;
      if (grupo && p.bitacoraHabilitadaEn && !grupo.presentacionFinal && !grupo.finalizadoEn) {
        pendientes.push({
          tipo: 'entregable',
          plantillaId: null,
          programaId: p.id,
          programaNombre: p.nombre,
          nombre: null,
          sesiones: [],
        });
      }
    }

    // 4) Formularios del programa pendientes (feedback / diagnóstico final). Deep-link
    // al formulario, con `?from` a la vista del programa correspondiente. Se excluye
    // el diagnóstico inicial por-programa: es un snapshot que NO se responde directo —
    // el estudiante contesta la encuesta de inicio GLOBAL (gate), así que el snapshot
    // nunca tendría respuesta y aparecería como pendiente para siempre (mismo criterio
    // que la vista del programa en SesionesPage).
    for (const pl of plantillas) {
      if (pl.programaId !== null && pl.tipoFormulario !== 'diagnostico_inicial' && !enviado(pl.respuestas)) {
        pendientes.push({
          tipo: 'formulario',
          plantillaId: pl.id,
          programaId: pl.programaId,
          programaNombre: pl.programa?.nombre ?? null,
          nombre: pl.nombre,
          sesiones: pl.sesiones.map((v) => v.sesion).sort((a, b) => a.numeroSesion - b.numeroSesion),
        });
      }
    }

    return pendientes;
  }

  /**
   * Pendientes de UN programa divididos por sesión (HU-13). El llamador ya verificó el acceso.
   * Los de ámbito estudiante (encuesta de inicio, matrículas) van siempre a `generales`; los de
   * programa (entregable, formulario) solo si son de `programaId`.
   */
  async agrupar(actor: AuthUser, programaId: string): Promise<PendientesAgrupados> {
    const todos = await this.listar(actor);
    const delPrograma = todos.filter(
      (p) => p.tipo === 'encuesta_inicio' || p.tipo === 'matricula' || p.programaId === programaId,
    );

    const sesiones = new Map<number, PendientesAgrupados['porSesion'][number]>();
    const generales: Pendiente[] = [];
    const now = Date.now();
    for (const p of delPrograma) {
      // N:M: un formulario ligado a varias sesiones aparece en cada una (y cuenta una vez en total).
      if (p.tipo === 'formulario' && p.sesiones.length > 0) {
        for (const ses of p.sesiones) {
          let grupo = sesiones.get(ses.numeroSesion);
          if (!grupo) {
            grupo = {
              numeroSesion: ses.numeroSesion,
              titulo: ses.titulo,
              fechaProgramada: ses.fechaProgramada,
              realizada: ses.fechaProgramada.getTime() < now,
              items: [],
            };
            sesiones.set(grupo.numeroSesion, grupo);
          }
          grupo.items.push(p);
        }
      } else {
        generales.push(p);
      }
    }

    const porSesion = [...sesiones.values()].sort((a, b) => a.numeroSesion - b.numeroSesion);
    return { total: delPrograma.length, porSesion, generales };
  }
}
