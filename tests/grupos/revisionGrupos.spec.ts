/**
 * HU-23 · lógica pura de la página de grupos del facilitador (extraída para poder testearla:
 * el repo no tiene render de React). Estado de revisión y orden: listos → en curso → finalizados.
 */

import { describe, it, expect } from 'vitest';

import {
  estadoRevision,
  ordenarPorRevision,
  contarListos,
  desglosarResumen,
  progresoEntrega,
} from '../../apps/web/src/features/facilitador/revisionGrupos';

const g = (over: Record<string, unknown> = {}) => ({
  id: 'g',
  orden: 1,
  finalizadoEn: null,
  entregaCompleta: false,
  ...over,
});

const ENTREGA = { entregaCompleta: true };

describe('estadoRevision', () => {
  it('sin entrega completa ni finalización → en_curso', () => {
    expect(estadoRevision(g())).toBe('en_curso');
  });

  it('entregó todo (entregaCompleta) y no está finalizado → listo', () => {
    expect(estadoRevision(g({ ...ENTREGA }))).toBe('listo');
  });

  it('finalizado gana sobre entregado', () => {
    expect(estadoRevision(g({ ...ENTREGA, finalizadoEn: '2026-10-02T00:00:00Z' }))).toBe('finalizado');
  });

  it('finalizado sin entrega completa (cerrado antes de la regla) → finalizado', () => {
    expect(estadoRevision(g({ finalizadoEn: '2026-10-02T00:00:00Z' }))).toBe('finalizado');
  });
});

describe('ordenarPorRevision', () => {
  const grupos = [
    g({ id: 'fin', orden: 1, finalizadoEn: 'x' }),
    g({ id: 'curso2', orden: 3 }),
    g({ id: 'listo2', orden: 4, ...ENTREGA }),
    g({ id: 'curso1', orden: 2 }),
    g({ id: 'listo1', orden: 2, ...ENTREGA }),
  ];

  it('listos primero, luego en curso, al final finalizados; dentro de cada uno por orden', () => {
    expect(ordenarPorRevision(grupos).map((x) => x.id)).toEqual(['listo1', 'listo2', 'curso1', 'curso2', 'fin']);
  });

  it('no muta el arreglo original', () => {
    const copia = grupos.map((x) => x.id);
    ordenarPorRevision(grupos);
    expect(grupos.map((x) => x.id)).toEqual(copia);
  });
});

describe('contarListos', () => {
  it('cuenta solo los grupos listos para revisar', () => {
    expect(contarListos([g(), g({ ...ENTREGA }), g({ ...ENTREGA, finalizadoEn: 'x' })])).toBe(1);
  });

  it('lista vacía → 0', () => {
    expect(contarListos([])).toBe(0);
  });
});

describe('desglosarResumen (mini-sección de la tarjeta del programa)', () => {
  it('reparte el total en finalizados, listos y en curso', () => {
    expect(desglosarResumen({ total: 10, listos: 3, finalizados: 4 })).toEqual({
      total: 10,
      finalizados: 4,
      listos: 3,
      enCurso: 3,
    });
  });

  it('los tres sumen siempre el total', () => {
    const d = desglosarResumen({ total: 2, listos: 1, finalizados: 0 });
    expect(d.finalizados + d.listos + d.enCurso).toBe(d.total);
    expect(d.enCurso).toBe(1);
  });

  it('sin grupos → todo en cero', () => {
    expect(desglosarResumen({ total: 0, listos: 0, finalizados: 0 })).toEqual({ total: 0, finalizados: 0, listos: 0, enCurso: 0 });
  });

  it('nunca devuelve enCurso negativo si los datos son inconsistentes', () => {
    expect(desglosarResumen({ total: 1, listos: 2, finalizados: 1 }).enCurso).toBe(0);
  });
});

describe('progresoEntrega (barra de entregables de cada grupo)', () => {
  it('nada entregado → 0 de 3, todos pendientes', () => {
    const p = progresoEntrega({ presentacion: true, bitacora: true, plantillaProyecto: true });
    expect(p.hechos).toBe(0);
    expect(p.total).toBe(3);
    expect(p.items.map((i) => i.hecho)).toEqual([false, false, false]);
  });

  it('parcial → cuenta y marca cuáles', () => {
    const p = progresoEntrega({ presentacion: true, bitacora: false, plantillaProyecto: false });
    expect(p.hechos).toBe(2);
    expect(p.items).toEqual([
      { clave: 'bitacora', hecho: true },
      { clave: 'plantillaProyecto', hecho: true },
      { clave: 'presentacion', hecho: false },
    ]);
  });

  it('todo entregado → 3 de 3', () => {
    expect(progresoEntrega({ presentacion: false, bitacora: false, plantillaProyecto: false }).hechos).toBe(3);
  });

  it('sin datos (respuesta vieja) → 0 de 3, no lanza', () => {
    expect(progresoEntrega(undefined).hechos).toBe(0);
  });
});
