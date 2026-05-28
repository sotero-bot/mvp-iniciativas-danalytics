/**
 * Convierte la PRIMERA hoja no vacía de un xlsx a una tabla markdown.
 * Las hojas adicionales (criterios, instructivos, etc.) se descartan a propósito —
 * solo nos interesa la respuesta del usuario, que vive en la primera hoja.
 */
export function excelToMarkdown(filePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const nonEmpty = rows.filter(row => row.some(c => String(c).trim() !== ''));
    if (nonEmpty.length === 0) continue;

    const [header, ...dataRows] = nonEmpty;
    const cols = header.length;

    const escape = (v: any) => String(v ?? '').trim().replace(/\|/g, '\\|').replace(/\n/g, ' ');

    const headerRow = '| ' + header.map(escape).join(' | ') + ' |';
    const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
    const bodyRows = dataRows.map(row =>
      '| ' + Array.from({ length: cols }, (_, i) => escape(row[i])).join(' | ') + ' |'
    );

    return [headerRow, separator, ...bodyRows].join('\n');
  }

  return '';
}
