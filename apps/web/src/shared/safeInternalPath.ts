// `?from=` llega por la URL, así que no es de confianza: solo se acepta una ruta interna
// ("/algo"). Se rechazan URLs absolutas, "//host", "/\host" y esquemas como javascript:.
export function safeInternalPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}
