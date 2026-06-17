/**
 * Extrae filas como arrays de valores por posición, ignorando los nombres de columna.
 * Robusto ante traducciones: funciona aunque el LLM haya traducido los headers.
 */
export function parseTablePositional(content: string): string[][] {
  const htmlTableMatch = content.match(/<table[\s\S]*?<\/table>/i);
  if (htmlTableMatch) {
    return parseHtmlTablePositional(htmlTableMatch[0]);
  }
  return parseMarkdownTablePositional(stripHtml(content));
}

function parseHtmlTablePositional(html: string): string[][] {
  const rowMatches = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
  const result: string[][] = [];
  let isFirst = true;
  for (const row of rowMatches) {
    if (isFirst) { isFirst = false; continue; } // skip header row
    const cellMatches = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length === 0) continue;
    result.push(cellMatches.map(m => stripHtml(m[1]).trim()));
  }
  return result;
}

function parseMarkdownTablePositional(text: string): string[][] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 3) return [];
  // lines[0] = headers, lines[1] = separator (|---|), lines[2+] = data
  return lines.slice(2).map(line =>
    line.split('|').map(c => c.trim()).filter(Boolean)
  );
}

/**
 * Extrae filas de una tabla a partir de contenido HTML o markdown.
 * Devuelve un array de objetos { columna: valor }.
 */
export function parseTableFromContent(content: string): Record<string, string>[] {
  const htmlTableMatch = content.match(/<table[\s\S]*?<\/table>/i);
  if (htmlTableMatch) {
    return parseHtmlTable(htmlTableMatch[0]);
  }
  return parseMarkdownTable(stripHtml(content));
}

function parseHtmlTable(html: string): Record<string, string>[] {
  const headerMatches = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
  const headers = headerMatches.map(m => stripHtml(m[1]).trim());
  if (headers.length === 0) return [];

  const rowMatches = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
  const result: Record<string, string>[] = [];

  for (const row of rowMatches) {
    const cellMatches = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length === 0) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = stripHtml(cellMatches[i]?.[1] ?? '').trim();
    });
    result.push(obj);
  }

  return result;
}

function parseMarkdownTable(text: string): Record<string, string>[] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 3) return [];

  const headers = lines[0]
    .split('|')
    .map(h => h.trim())
    .filter(Boolean);

  // lines[1] is the separator (|---|---|)
  const dataLines = lines.slice(2);

  return dataLines.map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
