/**
 * RF-09/RN-05: `startOfNextDayInTimeZone` — 00:01 del día siguiente en la timezone del programa.
 */

import { describe, it, expect } from 'vitest';
import { startOfNextDayInTimeZone } from '../../apps/api/src/shared/utils/timezone';

describe('startOfNextDayInTimeZone', () => {
  it('America/Bogota (UTC-5, sin DST): sesión a mediodía → desbloqueo 00:01 del día siguiente', () => {
    // 2026-07-06 12:00 America/Bogota = 2026-07-06 17:00 UTC
    const fechaProgramada = new Date('2026-07-06T17:00:00Z');
    const result = startOfNextDayInTimeZone(fechaProgramada, 'America/Bogota');
    // 00:01 del 2026-07-07 en Bogotá (UTC-5) = 2026-07-07T05:01:00Z
    expect(result.toISOString()).toBe('2026-07-07T05:01:00.000Z');
  });

  it('America/Sao_Paulo (UTC-3): sesión temprano → desbloqueo 00:01 del día siguiente', () => {
    // 2026-07-06 08:00 America/Sao_Paulo = 2026-07-06 11:00 UTC
    const fechaProgramada = new Date('2026-07-06T11:00:00Z');
    const result = startOfNextDayInTimeZone(fechaProgramada, 'America/Sao_Paulo');
    // 00:01 del 2026-07-07 en Sao Paulo (UTC-3) = 2026-07-07T03:01:00Z
    expect(result.toISOString()).toBe('2026-07-07T03:01:00.000Z');
  });

  it('sesión tarde en el día: el "día siguiente" cruza correctamente el mes', () => {
    // 2026-07-31 23:00 America/Bogota = 2026-08-01T04:00:00Z
    const fechaProgramada = new Date('2026-08-01T04:00:00Z');
    const result = startOfNextDayInTimeZone(fechaProgramada, 'America/Bogota');
    expect(result.toISOString()).toBe('2026-08-01T05:01:00.000Z');
  });
});
