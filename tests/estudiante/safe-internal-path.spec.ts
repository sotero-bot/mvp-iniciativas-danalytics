import { describe, it, expect } from 'vitest';

import { safeInternalPath } from '../../apps/web/src/shared/safeInternalPath';

const FALLBACK = '/estudiante/programas';

describe('safeInternalPath', () => {
  it('acepta una ruta interna', () => {
    expect(safeInternalPath('/estudiante/programas/p1/sesiones', FALLBACK)).toBe('/estudiante/programas/p1/sesiones');
  });

  it('sin valor → fallback', () => {
    expect(safeInternalPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath('', FALLBACK)).toBe(FALLBACK);
  });

  it('URL absoluta externa → fallback', () => {
    expect(safeInternalPath('https://evil.com/x', FALLBACK)).toBe(FALLBACK);
  });

  it('protocol-relative (//host) → fallback', () => {
    expect(safeInternalPath('//evil.com', FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath('/\\evil.com', FALLBACK)).toBe(FALLBACK);
  });

  it('esquemas peligrosos o rutas sin barra inicial → fallback', () => {
    expect(safeInternalPath('javascript:alert(1)', FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath('estudiante/x', FALLBACK)).toBe(FALLBACK);
  });
});
