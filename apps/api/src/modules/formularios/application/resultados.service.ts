import { Injectable } from '@nestjs/common';
import { Prisma, TipoFormulario } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import {
  agregarPorCampo,
  agregarScoresPorDimension,
  CampoAgregado,
  CampoParaFormato,
  DimensionAgregada,
} from './agregados';
import { ScoresPorDimension } from './scoring';

export interface DiagnosticoAgregado {
  totalRespuestas: number;
  dimensiones: DimensionAgregada[];
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

  // RF-34 (solo admin): individuales + comparativo inicial vs. final.
  async diagnosticoDetalle(programaId: string): Promise<{
    inicial: DiagnosticoAgregado & { individuales: DiagnosticoIndividual[] };
    final: DiagnosticoAgregado & { individuales: DiagnosticoIndividual[] };
    comparativo: { dimension: string; inicial: number | null; final: number | null }[];
  }> {
    const [inicial, final] = await Promise.all([
      this.detalleDeTipo(programaId, 'diagnostico_inicial'),
      this.detalleDeTipo(programaId, 'diagnostico_final'),
    ]);

    const dimensiones = new Set([
      ...inicial.dimensiones.map(d => d.dimension),
      ...final.dimensiones.map(d => d.dimension),
    ]);
    const comparativo = [...dimensiones].sort().map(dimension => ({
      dimension,
      inicial: inicial.dimensiones.find(d => d.dimension === dimension)?.promedio ?? null,
      final: final.dimensiones.find(d => d.dimension === dimension)?.promedio ?? null,
    }));

    return { inicial, final, comparativo };
  }

  private async agregadoDeTipo(
    programaId: string,
    tipo: TipoFormulario,
  ): Promise<DiagnosticoAgregado> {
    const respuestas = await this.prisma.respuestaFormulario.findMany({
      where: { programaId, estado: 'submitted', plantilla: { tipoFormulario: tipo } },
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
      where: { programaId, estado: 'submitted', plantilla: { tipoFormulario: tipo } },
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
