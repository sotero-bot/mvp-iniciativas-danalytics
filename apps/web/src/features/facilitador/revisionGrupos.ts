// HU-23: estado de revisión de un grupo para el facilitador. Lógica pura (testeable sin render).
//   listo      → entregó todo en la fase 3 (presentación + bitácora + plantilla, calculado en el
//                servidor como `entregaCompleta`) y aún no fue finalizado
//   en_curso   → todavía trabaja
//   finalizado → el revisor ya lo cerró (gana sobre "listo"; puede finalizarse sin entrega)

export type EstadoRevision = 'listo' | 'en_curso' | 'finalizado';

interface GrupoRevisable {
  orden: number;
  finalizadoEn: string | null;
  entregaCompleta: boolean;
}

const ORDEN_REVISION: Record<EstadoRevision, number> = { listo: 0, en_curso: 1, finalizado: 2 };

export function estadoRevision(g: Pick<GrupoRevisable, 'finalizadoEn' | 'entregaCompleta'>): EstadoRevision {
  if (g.finalizadoEn) return 'finalizado';
  return g.entregaCompleta ? 'listo' : 'en_curso';
}

/** Listos para revisar primero, luego en curso, al final finalizados; dentro de cada uno, por `orden`. */
export function ordenarPorRevision<T extends GrupoRevisable>(grupos: T[]): T[] {
  return [...grupos].sort(
    (a, b) => ORDEN_REVISION[estadoRevision(a)] - ORDEN_REVISION[estadoRevision(b)] || a.orden - b.orden,
  );
}

export function contarListos(grupos: GrupoRevisable[]): number {
  return grupos.filter((g) => estadoRevision(g) === 'listo').length;
}

export interface GruposResumen {
  total: number;
  listos: number;
  finalizados: number;
}

/** Reparte el total de un programa en tres grupos disjuntos que siempre suman `total`. */
export function desglosarResumen(r: GruposResumen) {
  return {
    total: r.total,
    finalizados: r.finalizados,
    listos: r.listos,
    enCurso: Math.max(0, r.total - r.listos - r.finalizados),
  };
}

export interface FaltanteEntrega {
  presentacion: boolean;
  bitacora: boolean;
  plantillaProyecto: boolean;
}

export type ClaveEntregable = 'bitacora' | 'plantillaProyecto' | 'presentacion';

/** Entregables de la fase 3 de un grupo: cuántos lleva y cuáles (`faltante` viene del servidor). */
export function progresoEntrega(faltante: FaltanteEntrega | undefined) {
  const f = faltante ?? { presentacion: true, bitacora: true, plantillaProyecto: true };
  const items: { clave: ClaveEntregable; hecho: boolean }[] = [
    { clave: 'bitacora', hecho: !f.bitacora },
    { clave: 'plantillaProyecto', hecho: !f.plantillaProyecto },
    { clave: 'presentacion', hecho: !f.presentacion },
  ];
  return { hechos: items.filter((i) => i.hecho).length, total: items.length, items };
}
