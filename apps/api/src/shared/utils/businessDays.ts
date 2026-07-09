/**
 * RF-03/RN-03: suma días hábiles a una fecha, excluyendo sábados y domingos.
 * No considera festivos (fuera de alcance de Fase 1).
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const dayOfWeek = result.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1;
    }
  }
  return result;
}
