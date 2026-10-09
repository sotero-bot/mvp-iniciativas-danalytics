import type { Prisma } from '@prisma/client';

// HU-14: filtro por área del detalle de programa del portal cliente.

/** Valor de `?areaId=` para "participantes sin área". */
export const SIN_AREA = 'sin_area';

/**
 * Mínimo de respuestas para mostrar un agregado de formulario FILTRADO por área.
 * Feedback y diagnóstico son anónimos (RF-33/RN-06): con un grupo más pequeño, el
 * "agregado" equivale a la respuesta de una persona. Sin filtro no se aplica.
 */
export const MIN_RESPUESTAS_ANONIMAS = 3;

/** `?areaId=` → condición sobre `Usuario`; `undefined` si no hay filtro. */
export function filtroUsuarioPorArea(areaId?: string): Prisma.UsuarioWhereInput | undefined {
  if (!areaId) return undefined;
  return areaId === SIN_AREA ? { areaId: null } : { areaId };
}

/** Oculta el contenido de un agregado filtrado con muy pocas respuestas. */
export function protegerAnonimato<T extends { totalRespuestas: number }>(
  agregado: T,
  filtrado: boolean,
  contenidoVacio: Record<string, unknown>,
): T | (Record<string, unknown> & { totalRespuestas: number; ocultoPorAnonimato: true }) {
  if (!filtrado || agregado.totalRespuestas === 0 || agregado.totalRespuestas >= MIN_RESPUESTAS_ANONIMAS) {
    return agregado;
  }
  return { ...contenidoVacio, totalRespuestas: agregado.totalRespuestas, ocultoPorAnonimato: true };
}
