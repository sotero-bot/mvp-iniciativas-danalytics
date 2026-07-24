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

// Tiempo relativo en días naturales ("hoy", "mañana", "en 3 días", "hace 2 días")
// para resaltar la cercanía de un evento sin la hora exacta. Usa Intl.RelativeTimeFormat
// (respeta el locale); el cálculo es por día de calendario, no por horas absolutas, para
// que una sesión de esta tarde diga "hoy" y no "en 5 horas".
export function formatDiasRelativos(iso: string, locale?: string): string {
  const target = new Date(iso);
  const now = new Date();
  const dia = 24 * 60 * 60 * 1000;
  const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const inicioTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const dias = Math.round((inicioTarget - inicioHoy) / dia);
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(dias, 'day');
  } catch {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(dias, 'day');
  }
}
