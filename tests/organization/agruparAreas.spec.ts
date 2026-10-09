/**
 * HU-14: normalización pura usada por el backfill y por el find-or-create de la importación.
 * La grafía canónica es la PRIMERA vista; la comparación ignora mayúsculas, acentos y espacios.
 */

import { describe, it, expect } from 'vitest';
import {
  agruparAreas,
  claveArea,
  normalizarNombreArea,
} from '../../apps/api/src/modules/organization/application/areas';

describe('normalizarNombreArea', () => {
  it('recorta y colapsa espacios internos, conservando mayúsculas y acentos', () => {
    expect(normalizarNombreArea('  Operaciones   Inmobiliarias ')).toBe('Operaciones Inmobiliarias');
    expect(normalizarNombreArea('Diseño')).toBe('Diseño');
  });
});

describe('claveArea', () => {
  it('ignora mayúsculas, acentos y espacios repetidos', () => {
    const k = claveArea('Diseño');
    expect(claveArea('diseño')).toBe(k);
    expect(claveArea('DISEÑO')).toBe(k);
    expect(claveArea('  Diseño  ')).toBe(k);
    expect(claveArea('Diseno')).toBe(k);
  });

  it('no confunde áreas distintas (no usa slug que colapsa símbolos)', () => {
    expect(claveArea('C++')).not.toBe(claveArea('C#'));
    expect(claveArea('Ops & Dev')).not.toBe(claveArea('Ops Dev'));
  });
});

describe('agruparAreas', () => {
  it('Diseño / diseño / DISEÑO / "  Diseño  " en la misma empresa → UNA sola área', () => {
    const r = agruparAreas([
      { empresaId: 'e1', area: 'Diseño' },
      { empresaId: 'e1', area: 'diseño' },
      { empresaId: 'e1', area: 'DISEÑO' },
      { empresaId: 'e1', area: '  Diseño  ' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].empresaId).toBe('e1');
    expect(r[0].nombre).toBe('Diseño'); // primera grafía vista
    expect(r[0].variantes).toEqual(expect.arrayContaining(['Diseño', 'diseño', 'DISEÑO']));
  });

  it('conserva la primera grafía vista aunque no sea la "mejor"', () => {
    const r = agruparAreas([
      { empresaId: 'e1', area: 'diseño' },
      { empresaId: 'e1', area: 'Diseño' },
    ]);
    expect(r[0].nombre).toBe('diseño');
  });

  it('la misma área en empresas distintas NO se funde (el catálogo es por empresa)', () => {
    const r = agruparAreas([
      { empresaId: 'e1', area: 'Operaciones' },
      { empresaId: 'e2', area: 'operaciones' },
    ]);
    expect(r).toHaveLength(2);
    expect(r.map(a => a.empresaId).sort()).toEqual(['e1', 'e2']);
  });

  it('colapsa espacios internos en el nombre canónico y conserva la variante cruda para vincular', () => {
    const r = agruparAreas([{ empresaId: 'e1', area: 'Ops   Team' }]);
    expect(r[0].nombre).toBe('Ops Team');
    expect(r[0].variantes).toEqual(['Ops   Team']);
  });

  it('ignora vacíos, solo-espacios y null', () => {
    expect(
      agruparAreas([
        { empresaId: 'e1', area: '' },
        { empresaId: 'e1', area: '   ' },
        { empresaId: 'e1', area: null },
      ]),
    ).toEqual([]);
  });

  it('sin duplicar variantes idénticas', () => {
    const r = agruparAreas([
      { empresaId: 'e1', area: 'Diseño' },
      { empresaId: 'e1', area: 'Diseño' },
    ]);
    expect(r[0].variantes).toEqual(['Diseño']);
  });
});
