/**
 * Plan 0 §1: fase pedagógica del programa, derivada (sin campo nuevo).
 * Función pura, sin mocks.
 */

import { describe, it, expect } from 'vitest';

import {
  derivarFasePrograma,
  presentacionHabilitada,
  type ProgramaParaFase,
} from '../../apps/api/src/modules/programas/application/fase-programa';

const NOW = new Date('2026-06-15T12:00:00Z');
const PASADA = new Date('2026-06-01T12:00:00Z');
const FUTURA = new Date('2026-07-01T12:00:00Z');

function programa(over: Partial<ProgramaParaFase> = {}): ProgramaParaFase {
  return {
    bitacoraHabilitadaEn: null,
    presentacionDesdeSesion: null,
    sesiones: [],
    ...over,
  };
}

describe('derivarFasePrograma', () => {
  it('sin sesiones → fase 1', () => {
    expect(derivarFasePrograma(programa(), NOW)).toEqual({ fase: 1, clave: 'entendimiento' });
  });

  it('todas las sesiones en el futuro → fase 1', () => {
    const p = programa({ sesiones: [{ numeroSesion: 1, fechaProgramada: FUTURA }] });
    expect(derivarFasePrograma(p, NOW).fase).toBe(1);
  });

  it('una sesión pasada, bitácora no habilitada, resto futuras → fase 2', () => {
    const p = programa({
      sesiones: [
        { numeroSesion: 1, fechaProgramada: PASADA },
        { numeroSesion: 2, fechaProgramada: FUTURA },
      ],
    });
    expect(derivarFasePrograma(p, NOW)).toEqual({ fase: 2, clave: 'sesiones' });
  });

  it('bitácora habilitada, presentacionDesdeSesion = null → fase 3', () => {
    const p = programa({
      bitacoraHabilitadaEn: PASADA,
      sesiones: [{ numeroSesion: 1, fechaProgramada: FUTURA }],
    });
    expect(derivarFasePrograma(p, NOW)).toEqual({ fase: 3, clave: 'presentacion_final' });
  });

  it('bitácora habilitada, presentacionDesdeSesion = 5, sesión 5 futura → fase 2', () => {
    const p = programa({
      bitacoraHabilitadaEn: PASADA,
      presentacionDesdeSesion: 5,
      sesiones: [
        { numeroSesion: 1, fechaProgramada: PASADA },
        { numeroSesion: 5, fechaProgramada: FUTURA },
      ],
    });
    expect(derivarFasePrograma(p, NOW).fase).toBe(2);
  });

  it('bitácora habilitada, presentacionDesdeSesion = 5, sesión 5 pasada → fase 3', () => {
    const p = programa({
      bitacoraHabilitadaEn: PASADA,
      presentacionDesdeSesion: 5,
      sesiones: [
        { numeroSesion: 5, fechaProgramada: PASADA },
        { numeroSesion: 6, fechaProgramada: FUTURA },
      ],
    });
    expect(derivarFasePrograma(p, NOW).fase).toBe(3);
  });

  it('bitácora NO habilitada pero todas las sesiones pasadas → fase 3 (fallback)', () => {
    const p = programa({
      sesiones: [
        { numeroSesion: 1, fechaProgramada: new Date('2026-05-01T00:00:00Z') },
        { numeroSesion: 2, fechaProgramada: PASADA },
      ],
    });
    expect(derivarFasePrograma(p, NOW).fase).toBe(3);
  });

  it('hayPresentacionEntregada = true, sin bitácora habilitada → fase 3', () => {
    const p = programa({ hayPresentacionEntregada: true });
    expect(derivarFasePrograma(p, NOW).fase).toBe(3);
  });
});

describe('presentacionHabilitada (RF-32 + O-01)', () => {
  it('bitácora no habilitada → false', () => {
    expect(presentacionHabilitada(programa(), NOW)).toBe(false);
  });

  it('bitácora habilitada y sin N → true', () => {
    expect(presentacionHabilitada(programa({ bitacoraHabilitadaEn: PASADA }), NOW)).toBe(true);
  });

  it('con N: solo true si existe sesión numeroSesion ≥ N ya ocurrida', () => {
    const base = { bitacoraHabilitadaEn: PASADA, presentacionDesdeSesion: 3 };
    expect(
      presentacionHabilitada(programa({ ...base, sesiones: [{ numeroSesion: 3, fechaProgramada: FUTURA }] }), NOW),
    ).toBe(false);
    expect(
      presentacionHabilitada(programa({ ...base, sesiones: [{ numeroSesion: 2, fechaProgramada: PASADA }] }), NOW),
    ).toBe(false);
    expect(
      presentacionHabilitada(programa({ ...base, sesiones: [{ numeroSesion: 4, fechaProgramada: PASADA }] }), NOW),
    ).toBe(true);
  });
});
