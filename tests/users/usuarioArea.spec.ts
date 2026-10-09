/**
 * HU-14: el área que muestra la tabla de /admin/usuarios sale del catálogo (`areaCatalogo`);
 * el texto libre deprecado (`area`) solo sirve de respaldo para usuarios aún no migrables
 * (p. ej. sin empresa).
 */
import { describe, it, expect } from 'vitest';
import { areaDeUsuario } from '../../apps/web/src/features/admin/usuarioArea';

describe('areaDeUsuario', () => {
  it('prefiere el nombre del catálogo', () => {
    expect(areaDeUsuario({ areaCatalogo: { id: 'a1', nombre: 'Diseño' }, area: 'diseño' })).toBe('Diseño');
  });
  it('sin catálogo cae al texto legado, recortado', () => {
    expect(areaDeUsuario({ areaCatalogo: null, area: '  Huérfana ' })).toBe('Huérfana');
  });
  it('sin ninguno → cadena vacía (la tabla pinta "—")', () => {
    expect(areaDeUsuario({ areaCatalogo: null, area: null })).toBe('');
    expect(areaDeUsuario({ areaCatalogo: null, area: '   ' })).toBe('');
  });
});
