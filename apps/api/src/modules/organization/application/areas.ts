// HU-14: normalización pura de nombres de área. Sin dependencias (la usan el backfill del
// seed y el find-or-create de la importación masiva).

/** Recorta y colapsa espacios internos. Conserva mayúsculas y acentos (valor que se almacena). */
export function normalizarNombreArea(s: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Clave de comparación: sin mayúsculas, sin acentos, espacios colapsados.
 * Solo para agrupar/comparar — NUNCA como valor almacenado.
 */
export function claveArea(s: string): string {
  return normalizarNombreArea(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export interface AreaAgrupada {
  empresaId: string;
  /** Primera grafía vista, normalizada (trim + espacios colapsados). */
  nombre: string;
  /** Textos crudos (recortados) que mapean a esta área; sirven para vincular usuarios. */
  variantes: string[];
}

/** Agrupa (empresaId, area) por empresa y clave; el catálogo es por empresa, nunca global. */
export function agruparAreas(filas: { empresaId: string; area: string | null }[]): AreaAgrupada[] {
  const grupos = new Map<string, AreaAgrupada>();
  for (const { empresaId, area } of filas) {
    const cruda = (area ?? '').trim();
    if (!cruda) continue;
    const clave = `${empresaId}\u0000${claveArea(cruda)}`;
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = { empresaId, nombre: normalizarNombreArea(cruda), variantes: [] };
      grupos.set(clave, grupo);
    }
    if (!grupo.variantes.includes(cruda)) grupo.variantes.push(cruda);
  }
  return [...grupos.values()];
}
