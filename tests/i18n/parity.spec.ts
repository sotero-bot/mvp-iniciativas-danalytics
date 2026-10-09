/**
 * Paridad es/pt (regla dura del CLAUDE.md): toda clave de `locales/es/*.json` existe en
 * `locales/pt/*.json` y viceversa. Hasta HU-23 no había red para esta regla.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const BASE = join(__dirname, '../../apps/web/src/i18n/locales');

function flat(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const read = (lng: string, file: string) => JSON.parse(readFileSync(join(BASE, lng, file), 'utf8'));

describe('paridad de locales es/pt', () => {
  it('ambos idiomas tienen los mismos archivos', () => {
    expect(readdirSync(join(BASE, 'pt')).sort()).toEqual(readdirSync(join(BASE, 'es')).sort());
  });

  for (const file of readdirSync(join(BASE, 'es'))) {
    it(`${file}: mismas claves en es y pt`, () => {
      const es = new Set(flat(read('es', file)));
      const pt = new Set(flat(read('pt', file)));
      expect([...es].filter((k) => !pt.has(k))).toEqual([]);
      expect([...pt].filter((k) => !es.has(k))).toEqual([]);
    });
  }
});
