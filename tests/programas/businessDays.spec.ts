/**
 * RF-03/RN-03: `addBusinessDays` suma días hábiles (excluye sáb/dom), sin festivos.
 */

import { describe, it, expect } from 'vitest';
import { addBusinessDays } from '../../apps/api/src/shared/utils/businessDays';

describe('addBusinessDays', () => {
  it('suma días hábiles simples sin cruzar fin de semana', () => {
    // 2026-07-06 es lunes
    const start = new Date('2026-07-06T00:00:00Z');
    const result = addBusinessDays(start, 3);
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-09');
  });

  it('salta el fin de semana al sumar días hábiles', () => {
    // 2026-07-09 es jueves; +3 días hábiles = vie(1) -> sáb/dom saltados -> lun(2) -> mar(3)
    const start = new Date('2026-07-09T00:00:00Z');
    const result = addBusinessDays(start, 3);
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-14');
  });

  it('con 0 días devuelve la misma fecha', () => {
    const start = new Date('2026-07-06T00:00:00Z');
    const result = addBusinessDays(start, 0);
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-06');
  });
});
