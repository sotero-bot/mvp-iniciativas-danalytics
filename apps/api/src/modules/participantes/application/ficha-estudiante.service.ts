import { Injectable } from '@nestjs/common';

import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import { AppError } from '../../../shared/errors/AppError';
import { AsistenciaResumenService } from '../../asistencia/application/asistencia-resumen.service';
import { derivarFasePrograma, type FaseResultado } from '../../programas/application/fase-programa';

// HU-16: ficha por estudiante para facilitador y cliente.
//
// RF-33/RN-06 acotan lo que se puede mostrar, para NINGÚN rol: solo el ESTADO de cada formulario
// (pendiente | borrador | enviado + fecha), nunca `datosRespuestaJson` ni `scoresPorDimensionJson`,
// y el feedback (anónimo) queda fuera del detalle por persona. Por eso cada objeto del resultado
// se construye campo a campo (lista blanca): no se esparcen filas de Prisma.

export type EstadoFormulario = 'pendiente' | 'borrador' | 'enviado';
export type EstadoReto = 'sin_grupo' | 'bloqueado' | 'sin_iniciar' | 'en_progreso' | 'entregado' | 'finalizado';

export interface FichaEstudiante {
  usuario: {
    id: string;
    nombre: string;
    email: string | null;
    cargo: string | null;
    area: { id: string; nombre: string } | null;
  };
  programa: { id: string; nombre: string; fase: FaseResultado };
  matricula: { activo: boolean; confirmadoEn: Date | null };
  asistencia: {
    sesiones: { numeroSesion: number; titulo: string; fechaProgramada: Date; presente: boolean | null }[];
    presentes: number;
    total: number;
    porcentaje: number | null;
  };
  formularios: {
    plantillaId: string;
    nombre: string;
    tipoFormulario: string;
    numeroSesion: number | null;
    estado: EstadoFormulario;
    enviadoEn: Date | null;
  }[];
  grupo: { id: string; nombre: string; miembros: { id: string; nombre: string }[] } | null;
  reto: { estado: EstadoReto; entregadoEn: Date | null; urlPresentacion?: string | null; conArchivo?: boolean };
}

export interface ParticipanteResumen {
  usuarioId: string;
  nombre: string;
  email: string;
  area: string | null;
  grupo: string | null;
  asistenciaPorcentaje: number;
  formulariosEnviados: number;
  formulariosTotal: number;
}

/**
 * RN-07: el cliente ve el ESTADO de la entrega, nunca el entregable. Función aparte (no `if`
 * dispersos) para que el recorte sea un único punto auditable.
 */
export function shapeFichaParaCliente(ficha: FichaEstudiante): FichaEstudiante {
  const { urlPresentacion: _url, conArchivo: _archivo, ...retoSinEntregable } = ficha.reto;
  return { ...ficha, reto: retoSinEntregable };
}

// Tipos individuales que aparecen en la ficha. `feedback` queda fuera (RN-06) y el
// `diagnostico_inicial` POR PROGRAMA también: es un snapshot que nunca se responde directo
// (el estudiante contesta la encuesta de inicio GLOBAL), igual que en pendientes-estudiante.
const TIPOS_EXCLUIDOS = new Set(['feedback']);

@Injectable()
export class FichaEstudianteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistenciaResumen: AsistenciaResumenService,
  ) {}

  async build(programaId: string, usuarioId: string, opts: { verEntregable: boolean }): Promise<FichaEstudiante> {
    const participante = await this.prisma.participantePrograma.findFirst({
      where: { programaId, usuarioId },
      select: {
        activo: true,
        confirmadoEn: true,
        usuario: {
          select: { id: true, nombre: true, email: true, cargo: true, areaCatalogo: { select: { id: true, nombre: true } } },
        },
      },
    });
    if (!participante) throw new AppError('PARTICIPANTE_NOT_FOUND');

    const [programa, plantillas, grupo, resumen] = await Promise.all([
      this.prisma.programa.findUnique({
        where: { id: programaId },
        select: {
          id: true,
          nombre: true,
          bitacoraHabilitadaEn: true,
          presentacionDesdeSesion: true,
          sesiones: { select: { numeroSesion: true, fechaProgramada: true } },
        },
      }),
      this.plantillasIndividuales(programaId, usuarioId),
      this.prisma.grupo.findFirst({
        where: { programaId, miembros: { some: { usuarioId } } },
        select: {
          id: true,
          nombre: true,
          finalizadoEn: true,
          miembros: { select: { usuario: { select: { id: true, nombre: true } } } },
          // `archivoKey` solo se lee para saber SI hay archivo; nunca sale ni se firma una URL.
          presentacionFinal: { select: { entregadoEn: true, urlPresentacion: true, archivoKey: true } },
          respuestasFormulario: {
            where: { plantilla: { is: { tipoFormulario: { in: ['bitacora', 'plantilla_proyecto'] }, activa: true } } },
            select: { id: true },
          },
        },
      }),
      // Coste: construye la matriz completa del programa por cada ficha. Aceptable a la escala
      // actual (decenas de participantes). Si el roster crece, el camino es añadir un
      // `buildFila(programaId, usuarioId)` a AsistenciaResumenService, no duplicar la lógica aquí.
      this.asistenciaResumen.build(programaId),
    ]);
    if (!programa) throw new AppError('PROGRAMA_NOT_FOUND');

    // Sin fila de asistencia en la sesión → `null` ("sin registro"), NO `false` ("ausente").
    const fila = resumen.filas.find((f) => f.usuarioId === usuarioId);
    const sesiones = resumen.sesiones.map((s) => ({
      numeroSesion: s.numeroSesion,
      titulo: s.titulo,
      fechaProgramada: s.fechaProgramada,
      presente: fila?.porSesion[s.id] ?? null,
    }));
    const presentes = sesiones.filter((s) => s.presente === true).length;
    const total = sesiones.length;

    const entregada = grupo?.presentacionFinal ?? null;
    let estadoReto: EstadoReto;
    if (!grupo) estadoReto = 'sin_grupo';
    else if (grupo.finalizadoEn) estadoReto = 'finalizado'; // HU-23
    else if (entregada) estadoReto = 'entregado';
    else if (!programa.bitacoraHabilitadaEn) estadoReto = 'bloqueado';
    else if (grupo.respuestasFormulario.length > 0) estadoReto = 'en_progreso';
    else estadoReto = 'sin_iniciar';

    const ficha: FichaEstudiante = {
      usuario: {
        id: participante.usuario.id,
        nombre: participante.usuario.nombre,
        email: participante.usuario.email,
        cargo: participante.usuario.cargo,
        area: participante.usuario.areaCatalogo
          ? { id: participante.usuario.areaCatalogo.id, nombre: participante.usuario.areaCatalogo.nombre }
          : null,
      },
      programa: {
        id: programa.id,
        nombre: programa.nombre,
        // Mirando a todos los grupos, la fase sale del gate del programa (como HU-12/HU-15).
        fase: derivarFasePrograma({ ...programa, hayPresentacionEntregada: false }),
      },
      matricula: { activo: participante.activo, confirmadoEn: participante.confirmadoEn },
      asistencia: {
        sesiones,
        presentes,
        total,
        porcentaje: total === 0 ? null : presentes / total,
      },
      formularios: plantillas.map((p) => {
        const respuesta = p.respuestas.find((r) => r.estado === 'submitted') ?? p.respuestas[0];
        return {
          plantillaId: p.id,
          nombre: p.nombre,
          tipoFormulario: p.tipoFormulario,
          numeroSesion: p.sesiones.length ? Math.min(...p.sesiones.map((s) => s.sesion.numeroSesion)) : null,
          estado: estadoDe(respuesta?.estado),
          enviadoEn: respuesta?.estado === 'submitted' ? (respuesta.enviadoEn ?? null) : null,
        };
      }),
      grupo: grupo
        ? { id: grupo.id, nombre: grupo.nombre, miembros: grupo.miembros.map((m) => ({ id: m.usuario.id, nombre: m.usuario.nombre })) }
        : null,
      reto: {
        estado: estadoReto,
        entregadoEn: entregada?.entregadoEn ?? null,
        urlPresentacion: entregada?.urlPresentacion ?? null,
        conArchivo: !!entregada?.archivoKey,
      },
    };

    return opts.verEntregable ? ficha : shapeFichaParaCliente(ficha);
  }

  /**
   * Roster del programa para el listado (un solo viaje): identidad, área, grupo, % de asistencia
   * y formularios enviados / total. `usuarioWhere` acota (p. ej. por área, HU-14).
   */
  async resumen(programaId: string, usuarioWhere?: Prisma.UsuarioWhereInput): Promise<ParticipanteResumen[]> {
    const [asistencia, grupos, plantillas] = await Promise.all([
      this.asistenciaResumen.build(programaId, usuarioWhere),
      this.prisma.grupo.findMany({
        where: { programaId },
        select: { nombre: true, miembros: { select: { usuarioId: true } } },
      }),
      this.plantillasIndividuales(programaId),
    ]);

    const grupoDe = new Map<string, string>();
    for (const g of grupos) for (const m of g.miembros) grupoDe.set(m.usuarioId, g.nombre);

    const plantillaIds = plantillas.map((p) => p.id);
    const enviadas = plantillaIds.length
      ? await this.prisma.respuestaFormulario.findMany({
          where: {
            plantillaId: { in: plantillaIds },
            usuarioRespondienteId: { in: asistencia.filas.map((f) => f.usuarioId) },
            estado: 'submitted',
          },
          select: { usuarioRespondienteId: true, plantillaId: true },
        })
      : [];
    const enviadasPor = new Map<string, Set<string>>();
    for (const r of enviadas) {
      if (!r.usuarioRespondienteId) continue;
      const set = enviadasPor.get(r.usuarioRespondienteId) ?? new Set<string>();
      set.add(r.plantillaId);
      enviadasPor.set(r.usuarioRespondienteId, set);
    }

    return asistencia.filas.map((f) => ({
      usuarioId: f.usuarioId,
      nombre: f.nombre,
      email: f.email,
      area: f.area,
      grupo: grupoDe.get(f.usuarioId) ?? null,
      asistenciaPorcentaje: f.porcentaje,
      formulariosEnviados: enviadasPor.get(f.usuarioId)?.size ?? 0,
      formulariosTotal: plantillaIds.length,
    }));
  }

  // Misma consulta de plantillas individuales que pendientes-estudiante (la encuesta de inicio
  // GLOBAL + las del programa), sin feedback ni snapshot inicial. Con `usuarioId` trae solo el
  // ESTADO de sus respuestas (nunca datos ni scores). Se re-filtra en código: defensa en
  // profundidad por si cambia el `where`.
  private async plantillasIndividuales(programaId: string, usuarioId?: string) {
    const plantillas = await this.prisma.plantillaFormulario.findMany({
      where: {
        activa: true,
        OR: [
          { programaId: null, tipoFormulario: 'diagnostico_inicial' },
          { programaId, tipoFormulario: 'diagnostico_final' },
        ],
      },
      select: {
        id: true,
        nombre: true,
        programaId: true,
        tipoFormulario: true,
        sesiones: { select: { sesion: { select: { numeroSesion: true } } } },
        respuestas: usuarioId
          ? { where: { usuarioRespondienteId: usuarioId }, select: { estado: true, enviadoEn: true } }
          : false,
      },
      orderBy: { createdAt: 'asc' },
    });
    return plantillas
      .filter(
        (p) =>
          !TIPOS_EXCLUIDOS.has(p.tipoFormulario) && (p.programaId === null || p.tipoFormulario !== 'diagnostico_inicial'),
      )
      .map((p) => ({ ...p, respuestas: ('respuestas' in p && Array.isArray(p.respuestas) ? p.respuestas : []) as { estado: string; enviadoEn: Date | null }[] }));
  }
}

function estadoDe(estado: string | undefined): EstadoFormulario {
  if (estado === 'submitted') return 'enviado';
  if (estado === 'draft') return 'borrador';
  return 'pendiente';
}
