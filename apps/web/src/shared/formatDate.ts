// Formatea un instante ISO como fecha + hora en la zona horaria del programa
// (ej. "America/Bogota"), de modo que la hora mostrada sea la local del programa
// y no la del navegador del espectador. Cae a la zona del navegador si `timeZone`
// es inválido o ausente.
export function formatFechaHora(iso: string, timeZone?: string, locale?: string): string {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  }
}
