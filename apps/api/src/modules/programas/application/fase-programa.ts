/**
 * Fase pedagógica del programa (HU-02), DERIVADA: no existe un campo `faseActual`.
 * Las señales ya existen: fecha de sesión 1 (abre fase 2) y bitacoraHabilitadaEn /
 * presentacionDesdeSesion (abren fase 3).
 *
 * Única extensión admisible si negocio la pide (p. ej. "las reuniones de entendimiento
 * siguen aunque ya hubo sesión 1"): `Programa.entendimientoHasta DateTime?` — una fecha,
 * no un estado. NO implementada.
 */

export type FaseClave = 'entendimiento' | 'sesiones' | 'presentacion_final';

export interface ProgramaParaFase {
  bitacoraHabilitadaEn: Date | null;
  presentacionDesdeSesion: number | null;
  sesiones: { numeroSesion: number; fechaProgramada: Date }[];
  hayPresentacionEntregada?: boolean;
}

export interface FaseResultado {
  fase: 1 | 2 | 3;
  clave: FaseClave;
}

/** Gate de la entrega final (RF-32 + O-01). Versión pura del helper que vivía
 *  en GrupoRecursosController: ahora recibe las sesiones en vez de consultarlas.
 *   1) la bitácora del programa debe estar habilitada, y
 *   2) sin N basta con (1); con N debe existir una sesión numeroSesion ≥ N ya ocurrida. */
export function presentacionHabilitada(p: ProgramaParaFase, now: Date): boolean {
  if (!p.bitacoraHabilitadaEn) return false;
  const desde = p.presentacionDesdeSesion;
  if (desde === null || desde === undefined) return true;
  return p.sesiones.some((s) => s.numeroSesion >= desde && s.fechaProgramada <= now);
}

export function derivarFasePrograma(p: ProgramaParaFase, now: Date = new Date()): FaseResultado {
  const ultima = p.sesiones.reduce<number | null>(
    (max, s) => (max === null || s.fechaProgramada.getTime() > max ? s.fechaProgramada.getTime() : max),
    null,
  );
  // El último disyuntivo es un fallback: calendario terminado sin bitácora habilitada = cierre.
  if (
    p.hayPresentacionEntregada === true ||
    presentacionHabilitada(p, now) ||
    (ultima !== null && ultima < now.getTime())
  ) {
    return { fase: 3, clave: 'presentacion_final' };
  }
  if (p.sesiones.some((s) => s.fechaProgramada <= now)) return { fase: 2, clave: 'sesiones' };
  return { fase: 1, clave: 'entendimiento' };
}
