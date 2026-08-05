import { Injectable } from '@nestjs/common';
import { Prisma, TipoFormulario } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import {
  agregarPorCampo,
  agregarScoresPorDimension,
  CampoAgregado,
  CampoParaFormato,
  DimensionesPorCategoria,
} from './agregados';
import { ScoresPorDimension } from './scoring';

export interface DiagnosticoAgregado {
  totalRespuestas: number;
  dimensiones: DimensionesPorCategoria;
}

export interface ComparativoDimension {
  dimension: string;
  inicial: number | null;
  final: number | null;
  preguntas: number;
}

export interface DiagnosticoIndividual {
  usuario: { id: string; nombre: string; email: string };
  scores: ScoresPorDimension | null;
  enviadoEn: Date | null;
}

export interface CampoDiagnostico extends CampoParaFormato {
  orden: number;
}

export interface DiagnosticoInicialGlobal extends DiagnosticoAgregado {
  porCampo: CampoAgregado[];
  campos: CampoDiagnostico[];
  individuales: (DiagnosticoIndividual & { datos: Record<string, unknown> })[];
}

/**
 * Consultas de resultados (Plan 2 §2.4). Las vistas agregadas NUNCA incluyen
 * identificadores de respondiente (RF-33/RF-36/RN-06); los individuales solo
 * los arma `diagnosticoDetalle`, reservado al controller de admin (RF-34).
 */
@Injectable()
export class ResultadosService {
  constructor(private readonly prisma: PrismaService) {}

  async diagnosticoAgregado(programaId: string): Promise<{
    inicial: DiagnosticoAgregado;
    final: DiagnosticoAgregado;
  }> {
    const [inicial, final] = await Promise.all([
      this.agregadoDeTipo(programaId, 'diagnostico_inicial'),
      this.agregadoDeTipo(programaId, 'diagnostico_final'),
    ]);
    return { inicial, final };
  }

  // RF-36/RN-06: feedback agregado y anónimo — se descartan los ids de
  // respondiente antes de agregar; ningún campo del resultado los contiene.
  async feedbackAgregado(programaId: string): Promise<{
    totalRespuestas: number;
    campos: CampoAgregado[];
  }> {
    const respuestas = await this.prisma.respuestaFormulario.findMany({
      where: { programaId, estado: 'submitted', plantilla: { tipoFormulario: 'feedback' } },
      select: { datosRespuestaJson: true, plantillaId: true },
    });
    if (respuestas.length === 0) return { totalRespuestas: 0, campos: [] };

    const campos = await this.prisma.campoFormulario.findMany({
      where: { plantillaId: { in: [...new Set(respuestas.map(r => r.plantillaId))] } },
      select: { id: true, tipoCampo: true, etiqueta: true, configJson: true, orden: true },
      orderBy: { orden: 'asc' },
    });

    return {
      totalRespuestas: respuestas.length,
      campos: agregarPorCampo(
        campos,
        respuestas.map(r => (r.datosRespuestaJson ?? {}) as Record<string, unknown>),
      ),
    };
  }

  // RF-34 (solo admin): individuales + comparativo inicial vs. final. Escala y
  // selección se comparan por separado — nunca se combinan (ver scoring.ts).
  async diagnosticoDetalle(programaId: string): Promise<{
    inicial: DiagnosticoAgregado & { individuales: DiagnosticoIndividual[] };
    final: DiagnosticoAgregado & { individuales: DiagnosticoIndividual[] };
    comparativo: DimensionesPorCategoria<ComparativoDimension>;
  }> {
    const [inicial, final] = await Promise.all([
      this.detalleDeTipo(programaId, 'diagnostico_inicial'),
      this.detalleDeTipo(programaId, 'diagnostico_final'),
    ]);

    return {
      inicial,
      final,
      comparativo: {
        escala: this.compararCategoria(inicial.dimensiones.escala, final.dimensiones.escala),
        seleccion: this.compararCategoria(inicial.dimensiones.seleccion, final.dimensiones.seleccion),
      },
    };
  }

  private compararCategoria(
    inicial: DiagnosticoAgregado['dimensiones']['escala'],
    final: DiagnosticoAgregado['dimensiones']['escala'],
  ): ComparativoDimension[] {
    const dimensiones = new Set([...inicial.map(d => d.dimension), ...final.map(d => d.dimension)]);
    return [...dimensiones].sort().map(dimension => {
      const dInicial = inicial.find(d => d.dimension === dimension);
      const dFinal = final.find(d => d.dimension === dimension);
      return {
        dimension,
        inicial: dInicial?.promedio ?? null,
        final: dFinal?.promedio ?? null,
        preguntas: Math.max(dInicial?.preguntas ?? 0, dFinal?.preguntas ?? 0),
      };
    });
  }

  // diagnostico_inicial es GLOBAL (RF-28): el estudiante lo responde una sola
  // vez sin importar el programa, y la respuesta queda con programaId=null
  // (ver TIPOS_GLOBALES_DIRECTOS en estudiante-formularios.controller.ts). Para
  // el detalle/agregado por-programa no se puede filtrar por
  // RespuestaFormulario.programaId (siempre null); hay que ubicar la respuesta
  // por matrícula activa del estudiante en ese programa, igual que
  // diagnosticoInicialGlobal.
  private whereRespuestasDeTipo(
    programaId: string,
    tipo: TipoFormulario,
  ): Prisma.RespuestaFormularioWhereInput {
    if (tipo === 'diagnostico_inicial') {
      return {
        estado: 'submitted',
        plantilla: { tipoFormulario: tipo, programaId: null },
        usuarioRespondiente: { participaciones: { some: { programaId, activo: true } } },
      };
    }
    return { programaId, estado: 'submitted', plantilla: { tipoFormulario: tipo } };
  }

  private async agregadoDeTipo(
    programaId: string,
    tipo: TipoFormulario,
  ): Promise<DiagnosticoAgregado> {
    const respuestas = await this.prisma.respuestaFormulario.findMany({
      where: this.whereRespuestasDeTipo(programaId, tipo),
      select: { scoresPorDimensionJson: true },
    });
    return {
      totalRespuestas: respuestas.length,
      dimensiones: agregarScoresPorDimension(
        respuestas.map(r => r.scoresPorDimensionJson as unknown as ScoresPorDimension | null),
      ),
    };
  }

  private async detalleDeTipo(programaId: string, tipo: TipoFormulario) {
    const respuestas = await this.prisma.respuestaFormulario.findMany({
      where: this.whereRespuestasDeTipo(programaId, tipo),
      select: {
        scoresPorDimensionJson: true,
        enviadoEn: true,
        usuarioRespondiente: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { enviadoEn: 'asc' },
    });

    return {
      totalRespuestas: respuestas.length,
      dimensiones: agregarScoresPorDimension(
        respuestas.map(r => r.scoresPorDimensionJson as unknown as ScoresPorDimension | null),
      ),
      individuales: respuestas
        .filter(r => r.usuarioRespondiente)
        .map(r => ({
          usuario: r.usuarioRespondiente!,
          scores: (r.scoresPorDimensionJson ?? null) as unknown as ScoresPorDimension | null,
          enviadoEn: r.enviadoEn,
        })),
    };
  }

  // Diagnóstico de inicio GLOBAL (plantilla programaId=null, RF-28): NO está atado
  // a un programa. Agrega TODAS las respuestas enviadas de estudiantes de la
  // plataforma, no las de un programa concreto (por eso `programaId: null`).
  // Reservado a danalytics_admin (RN-07): además de scores por dimensión, devuelve
  // el desglose por pregunta (conteo por opción, promedios, textos) y las respuestas
  // individuales completas (con `datos` crudos) para el detalle y el Excel.
  async diagnosticoInicialGlobal(
    filtros?: { empresaId?: string; programaId?: string },
  ): Promise<DiagnosticoInicialGlobal> {
    // La respuesta global no tiene programa propio (programaId=null); el filtro por
    // empresa/programa se resuelve por la MATRÍCULA activa del estudiante que respondió.
    const where: Prisma.RespuestaFormularioWhereInput = {
      programaId: null,
      estado: 'submitted',
      plantilla: { is: { programaId: null, tipoFormulario: 'diagnostico_inicial' } },
    };
    if (filtros?.empresaId || filtros?.programaId) {
      const participacion: Prisma.ParticipanteProgramaWhereInput = { activo: true };
      if (filtros.programaId) participacion.programaId = filtros.programaId;
      if (filtros.empresaId) participacion.programa = { empresaId: filtros.empresaId };
      where.usuarioRespondiente = { is: { participaciones: { some: participacion } } };
    }

    const respuestas = await this.prisma.respuestaFormulario.findMany({
      where,
      select: {
        plantillaId: true,
        datosRespuestaJson: true,
        scoresPorDimensionJson: true,
        enviadoEn: true,
        usuarioRespondiente: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { enviadoEn: 'asc' },
    });

    // Solo los campos de las plantillas efectivamente respondidas (evita mostrar
    // preguntas de versiones sin respuestas).
    const plantillaIds = [...new Set(respuestas.map(r => r.plantillaId))];
    const campos = plantillaIds.length
      ? await this.prisma.campoFormulario.findMany({
          where: { plantillaId: { in: plantillaIds } },
          select: {
            id: true,
            campoPadreId: true,
            tipoCampo: true,
            etiqueta: true,
            orden: true,
            configJson: true,
          },
          orderBy: { orden: 'asc' },
        })
      : [];

    const camposTop = campos.filter(c => !c.campoPadreId);
    const datosList = respuestas.map(r => (r.datosRespuestaJson ?? {}) as Record<string, unknown>);

    return {
      totalRespuestas: respuestas.length,
      dimensiones: agregarScoresPorDimension(
        respuestas.map(r => r.scoresPorDimensionJson as unknown as ScoresPorDimension | null),
      ),
      porCampo: agregarPorCampo(camposTop, datosList),
      campos: campos.map(c => ({
        id: c.id,
        campoPadreId: c.campoPadreId,
        tipoCampo: c.tipoCampo,
        etiqueta: c.etiqueta,
        orden: c.orden,
        configJson: c.configJson,
      })),
      individuales: respuestas
        .filter(r => r.usuarioRespondiente)
        .map(r => ({
          usuario: r.usuarioRespondiente!,
          scores: (r.scoresPorDimensionJson ?? null) as unknown as ScoresPorDimension | null,
          datos: (r.datosRespuestaJson ?? {}) as Record<string, unknown>,
          enviadoEn: r.enviadoEn,
        })),
    };
  }
}
