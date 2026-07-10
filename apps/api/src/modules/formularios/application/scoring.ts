import { TipoCampo } from '@prisma/client';

import { ConfigCampo } from './form-config';

/**
 * Scoring del diagnóstico (RF-29, RF-26): se calcula SOLO server-side al enviar.
 * El respondiente nunca recibe el desglose ni el puntaje (RNF-04/RN-02).
 */

export interface CampoParaScoring {
  id: string;
  tipoCampo: TipoCampo;
  dimension: string | null;
  configJson: unknown;
}

export interface ScoreDimension {
  total: number;
  promedio: number;
  respondidas: number;
}

export type ScoresPorDimension = Record<string, ScoreDimension>;

/**
 * Score de una respuesta individual a un campo, o null si no puntúa.
 *  - likert / numero → el valor numérico respondido.
 *  - opcion_multiple → `score` de la(s) opción(es) elegida(s) en configJson
 *    (suma si `multiple`); opciones sin score puntúan 0.
 *  - resto de tipos → no puntúan.
 */
export function scoreDeCampo(campo: CampoParaScoring, valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const config = (campo.configJson ?? {}) as ConfigCampo;

  switch (campo.tipoCampo) {
    case 'likert':
    case 'numero': {
      const n = typeof valor === 'number' ? valor : Number(valor);
      return Number.isFinite(n) ? n : null;
    }
    case 'opcion_multiple': {
      const opciones = config.opciones ?? [];
      const elegidos = Array.isArray(valor) ? valor : [valor];
      let hit = false;
      let total = 0;
      for (const elegido of elegidos) {
        const opcion = opciones.find(op => op.valor === elegido);
        if (opcion) {
          hit = true;
          total += opcion.score ?? 0;
        }
      }
      return hit ? total : null;
    }
    default:
      return null;
  }
}

/**
 * RF-26/RF-29: agrega los scores por `dimension` de campo. Campos sin dimensión
 * o sin respuesta puntuable no participan.
 */
export function calcularScoresPorDimension(
  campos: CampoParaScoring[],
  datosRespuesta: Record<string, unknown>,
): ScoresPorDimension {
  const acumulado: Record<string, { total: number; respondidas: number }> = {};

  for (const campo of campos) {
    if (!campo.dimension) continue;
    const score = scoreDeCampo(campo, datosRespuesta[campo.id]);
    if (score === null) continue;
    const bucket = (acumulado[campo.dimension] ??= { total: 0, respondidas: 0 });
    bucket.total += score;
    bucket.respondidas += 1;
  }

  const resultado: ScoresPorDimension = {};
  for (const [dimension, { total, respondidas }] of Object.entries(acumulado)) {
    resultado[dimension] = { total, respondidas, promedio: total / respondidas };
  }
  return resultado;
}
