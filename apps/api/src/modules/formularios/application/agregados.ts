import { TipoCampo } from '@prisma/client';

import { ConfigCampo } from './form-config';
import { CategoriaScore, ScoresPorDimension } from './scoring';

/**
 * Agregados de resultados (Plan 2 §2.4 — RF-33/34/35/36, RN-06).
 *
 * Todo lo que consumen facilitador y cliente pasa por aquí: promedios por dimensión
 * y distribución por campo, SIN ningún identificador de respondiente (RN-06: el
 * feedback es anónimo; RF-33: el facilitador no ve individuales).
 */

export interface DimensionAgregada {
  dimension: string;
  promedio: number;
  n: number;
  /** Cuántas preguntas del formulario componen esta dimensión (máx. de
   * `respondidas` visto entre los respondientes). Sirve para distinguir en la
   * UI una dimensión de una sola pregunta (el promedio es directo) de una que
   * combina varias (el promedio del estudiante ya es en sí un promedio). */
  preguntas: number;
}

export interface CampoParaAgregado {
  id: string;
  tipoCampo: TipoCampo;
  etiqueta: string;
  configJson: unknown;
}

/** Dimensiones agregadas, separadas en dos secciones que nunca se mezclan:
 * "escala" (likert/número) y "seleccion" (opción múltiple). */
export interface DimensionesPorCategoria<T = DimensionAgregada> {
  escala: T[];
  seleccion: T[];
}

/**
 * Promedio por dimensión sobre los `scoresPorDimensionJson` ya calculados en el
 * submit (RF-29): promedio de los promedios individuales, n = respondientes.
 * Escala y selección se agregan por separado (nunca se combinan en un mismo
 * promedio, aunque compartan `dimension`).
 */
export function agregarScoresPorDimension(
  scoresList: (ScoresPorDimension | null | undefined)[],
): DimensionesPorCategoria {
  const agregarCategoria = (categoria: CategoriaScore): DimensionAgregada[] => {
    const buckets: Record<string, { suma: number; n: number; preguntas: number }> = {};
    for (const scores of scoresList) {
      const grupo = scores?.[categoria];
      if (!grupo || typeof grupo !== 'object') continue;
      for (const [dimension, score] of Object.entries(grupo)) {
        if (typeof score?.promedio !== 'number') continue;
        const bucket = (buckets[dimension] ??= { suma: 0, n: 0, preguntas: 0 });
        bucket.suma += score.promedio;
        bucket.n += 1;
        bucket.preguntas = Math.max(bucket.preguntas, score.respondidas ?? 0);
      }
    }
    return Object.entries(buckets)
      .map(([dimension, { suma, n, preguntas }]) => ({ dimension, promedio: suma / n, n, preguntas }))
      .sort((a, b) => a.dimension.localeCompare(b.dimension));
  };

  return { escala: agregarCategoria('escala'), seleccion: agregarCategoria('seleccion') };
}

export type CampoAgregado =
  | { campoId: string; etiqueta: string; tipoCampo: TipoCampo; promedio: number | null; n: number }
  | { campoId: string; etiqueta: string; tipoCampo: TipoCampo; opciones: { valor: string; etiqueta: string; conteo: number }[]; n: number }
  | { campoId: string; etiqueta: string; tipoCampo: TipoCampo; textos: string[]; n: number };

/**
 * RF-36/RN-06: agregado por campo para el feedback — anónimo por construcción
 * (recibe solo los `datosRespuestaJson`, nunca quién respondió).
 *  - likert / numero → promedio.
 *  - opcion_multiple → conteo por opción.
 *  - texto_corto / texto_largo → lista de textos sin autor.
 */
export function agregarPorCampo(
  campos: CampoParaAgregado[],
  datosList: Record<string, unknown>[],
): CampoAgregado[] {
  return campos.map((campo) => {
    const valores = datosList
      .map(datos => datos?.[campo.id])
      .filter(v => v !== undefined && v !== null && v !== '');
    const base = { campoId: campo.id, etiqueta: campo.etiqueta, tipoCampo: campo.tipoCampo };

    switch (campo.tipoCampo) {
      case 'likert':
      case 'numero': {
        const numeros = valores.map(v => (typeof v === 'number' ? v : Number(v))).filter(Number.isFinite);
        return {
          ...base,
          promedio: numeros.length > 0 ? numeros.reduce((a, b) => a + b, 0) / numeros.length : null,
          n: numeros.length,
        };
      }
      case 'opcion_multiple': {
        const config = (campo.configJson ?? {}) as ConfigCampo;
        const conteos = new Map<string, number>();
        for (const v of valores) {
          for (const elegido of Array.isArray(v) ? v : [v]) {
            const key = String(elegido);
            conteos.set(key, (conteos.get(key) ?? 0) + 1);
          }
        }
        return {
          ...base,
          opciones: (config.opciones ?? []).map(op => ({
            valor: op.valor,
            etiqueta: op.etiqueta,
            conteo: conteos.get(op.valor) ?? 0,
          })),
          n: valores.length,
        };
      }
      case 'texto_corto':
      case 'texto_largo':
        return { ...base, textos: valores.map(v => String(v)), n: valores.length };
      default:
        return { ...base, textos: [], n: valores.length };
    }
  });
}

export interface CampoParaFormato {
  id: string;
  tipoCampo: TipoCampo;
  etiqueta: string;
  configJson: unknown;
  campoPadreId?: string | null;
}

/**
 * Convierte el valor guardado de un campo en un texto legible para reportes/Excel
 * (RF-34, admin): opción múltiple → etiqueta(s), likert/numero/texto → tal cual,
 * tabla → filas "col: valor", grupo_repetible → iteraciones con sus hijos.
 */
export function formatValorLegible(
  campo: CampoParaFormato,
  valor: unknown,
  hijosPorPadre?: Map<string, CampoParaFormato[]>,
): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const config = (campo.configJson ?? {}) as ConfigCampo;

  switch (campo.tipoCampo) {
    case 'opcion_multiple': {
      const elegidos = Array.isArray(valor) ? valor : [valor];
      const opciones = config.opciones ?? [];
      return elegidos
        .map(v => opciones.find(op => op.valor === v)?.etiqueta ?? String(v))
        .join('; ');
    }
    case 'tabla': {
      const columnas = config.columnas ?? [];
      const filas = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      return filas
        .map((fila, i) => `#${i + 1} ` + columnas.map(c => `${c}: ${fila?.[c] ?? ''}`).join(', '))
        .join(' | ');
    }
    case 'grupo_repetible': {
      const iteraciones = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      const hijos = hijosPorPadre?.get(campo.id) ?? [];
      return iteraciones
        .map(
          (it, i) =>
            `#${i + 1} ` +
            hijos.map(h => `${h.etiqueta}: ${formatValorLegible(h, it[h.id], hijosPorPadre)}`).join(', '),
        )
        .join(' | ');
    }
    default:
      return String(valor);
  }
}
