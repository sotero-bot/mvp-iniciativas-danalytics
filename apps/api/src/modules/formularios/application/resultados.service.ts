import { Injectable } from '@nestjs/common';
import { TipoFormulario } from '@prisma/client';

import { PrismaService } from '../../../prisma.service';
import {
  agregarPorCampo,
  agregarScoresPorDimension,
  CampoAgregado,
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
}
