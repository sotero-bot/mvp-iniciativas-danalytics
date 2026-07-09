/**
 * RF-09/RN-05: calcula el instante UTC correspondiente a las 00:01 del día
 * siguiente a `date`, en la zona horaria `timeZone` (ej. "America/Bogota").
 * Usa solo `Intl.DateTimeFormat` (sin dependencias nuevas).
 */
export function startOfNextDayInTimeZone(date: Date, timeZone: string): Date {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  // Instante "adivinado" tratando el día siguiente 00:01 como si fuera UTC.
  const guess = new Date(Date.UTC(year, month - 1, day + 1, 0, 1, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

function getDatePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === 'year')!.value),
    month: Number(parts.find((p) => p.type === 'month')!.value),
    day: Number(parts.find((p) => p.type === 'day')!.value),
  };
}

/** Offset (en minutos, UTC - local) de `timeZone` en el instante `date`. */
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asUtc - date.getTime()) / 60_000;
}
