import { TipoCampo } from '@prisma/client';

import { AppError } from '../../../shared/errors/AppError';

/**
 * Config por tipo de campo (RF-24, Plan 2 §2.0 #2/#4).
 *
 * `configJson` (privado, solo admin) puede contener `score` por opción — RNF-04/RN-02:
 * JAMÁS se serializa a roles ≠ danalytics_admin. Lo que el respondiente necesita para
 * renderizar viaja en `configPublica`, derivada server-side por `derivarConfigPublica`.
 */

export interface OpcionCampo {
  valor: string;
  etiqueta: string;
  score?: number;
}

export interface ConfigCampo {
  // opcion_multiple
  opciones?: OpcionCampo[];
  multiple?: boolean; // checkboxes (§2.0 #2)
  // likert
  min?: number;
  max?: number;
  etiquetaMin?: string;
  etiquetaMax?: string;
  // tabla
  columnas?: string[];
  // sección visual (§2.0 #3): agrupador configurado en el builder
  seccion?: string;
}

function invalida(message: string): never {
  throw new AppError('CAMPO_CONFIG_INVALIDA', { message });
}

/**
 * Valida `configJson` según el `tipoCampo` (RF-24). Lanza CAMPO_CONFIG_INVALIDA.
 */
export function validarConfigCampo(tipoCampo: TipoCampo, config: unknown): ConfigCampo {
  if (config === null || config === undefined) return {};
  if (typeof config !== 'object' || Array.isArray(config)) {
    invalida('configJson debe ser un objeto');
  }
  const c = config as ConfigCampo;

  switch (tipoCampo) {
    case 'opcion_multiple': {
      if (!Array.isArray(c.opciones) || c.opciones.length === 0) {
        invalida('opcion_multiple requiere "opciones" (array no vacío)');
      }
      for (const op of c.opciones) {
        if (!op || typeof op.valor !== 'string' || typeof op.etiqueta !== 'string') {
          invalida('cada opción requiere "valor" y "etiqueta" (string)');
        }
        if (op.score !== undefined && typeof op.score !== 'number') {
          invalida('el "score" de una opción debe ser numérico');
        }
      }
      break;
    }
    case 'likert': {
      const min = c.min ?? 1;
      const max = c.max ?? 5;
      if (typeof min !== 'number' || typeof max !== 'number' || !(min < max)) {
        invalida('likert requiere min < max numéricos');
      }
      break;
    }
    case 'tabla': {
      if (!Array.isArray(c.columnas) || c.columnas.length === 0 || c.columnas.some(col => typeof col !== 'string')) {
        invalida('tabla requiere "columnas" (array de strings no vacío)');
      }
      break;
    }
    case 'numero': {
      if (c.min !== undefined && typeof c.min !== 'number') invalida('min debe ser numérico');
      if (c.max !== undefined && typeof c.max !== 'number') invalida('max debe ser numérico');
      break;
    }
    default:
      // texto_corto / texto_largo / grupo_repetible: sin config obligatoria.
      break;
  }
  return c;
}

/**
 * RNF-04/RN-02: deriva la config pública por tipo — SIN `score` ni nada interno.
 * Es lo único del configJson que ve un respondiente.
 */
export function derivarConfigPublica(tipoCampo: TipoCampo, config: unknown): Record<string, unknown> {
  const c = (config && typeof config === 'object' && !Array.isArray(config) ? config : {}) as ConfigCampo;
  const publica: Record<string, unknown> = {};
  if (c.seccion !== undefined) publica.seccion = c.seccion;

  switch (tipoCampo) {
    case 'opcion_multiple':
      publica.opciones = (c.opciones ?? []).map(op => ({ valor: op.valor, etiqueta: op.etiqueta }));
      publica.multiple = c.multiple === true;
      break;
    case 'likert':
      publica.min = c.min ?? 1;
      publica.max = c.max ?? 5;
      if (c.etiquetaMin !== undefined) publica.etiquetaMin = c.etiquetaMin;
      if (c.etiquetaMax !== undefined) publica.etiquetaMax = c.etiquetaMax;
      break;
    case 'tabla':
      publica.columnas = c.columnas ?? [];
      break;
    case 'numero':
      if (c.min !== undefined) publica.min = c.min;
      if (c.max !== undefined) publica.max = c.max;
      break;
    default:
      break;
  }
  return publica;
}
