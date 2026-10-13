/**
 * HU-13: `pendienteTo()` se extrajo de EstudianteHome para compartirlo con PendientesPage.
 * Caracteriza los destinos que tenía el inicio.
 */
import { describe, it, expect } from 'vitest';

import { pendienteTo, etiquetaSesiones } from '../../apps/web/src/features/estudiante/pendientes';
import type { Pendiente } from '../../apps/web/src/features/estudiante/pendientes';

const base: Pendiente = {
  tipo: 'formulario',
  plantillaId: 'pl1',
  programaId: 'p1',
  programaNombre: 'P',
  nombre: 'N',
  sesiones: [],
};

describe('pendienteTo', () => {
  it('encuesta_inicio → formulario con retorno al inicio', () => {
    expect(pendienteTo({ ...base, tipo: 'encuesta_inicio', programaId: null })).toBe(
      '/estudiante/formularios/pl1?from=%2Finicio',
    );
  });

  it('formulario → formulario con retorno a las sesiones del programa', () => {
    expect(pendienteTo(base)).toBe(
      '/estudiante/formularios/pl1?from=%2Festudiante%2Fprogramas%2Fp1%2Fsesiones',
    );
  });

  it('entregable → sesiones del programa', () => {
    expect(pendienteTo({ ...base, tipo: 'entregable', plantillaId: null })).toBe('/estudiante/programas/p1/sesiones');
  });

  it('matricula → listado de programas', () => {
    expect(pendienteTo({ ...base, tipo: 'matricula', plantillaId: null })).toBe('/estudiante/programas');
  });
});

describe('etiquetaSesiones', () => {
  it('sin sesiones → null', () => {
    expect(etiquetaSesiones(base)).toBeNull();
  });

  it('una sesión → count 1 y su número', () => {
    const s = { numeroSesion: 2, titulo: 'T', fechaProgramada: '2026-01-01' };
    expect(etiquetaSesiones({ ...base, sesiones: [s] })).toEqual({ count: 1, lista: '2' });
  });

  it('varias sesiones → ordenadas y separadas por coma', () => {
    const mk = (n: number) => ({ numeroSesion: n, titulo: 'T', fechaProgramada: '2026-01-01' });
    expect(etiquetaSesiones({ ...base, sesiones: [mk(3), mk(1)] })).toEqual({ count: 2, lista: '1, 3' });
  });
});
