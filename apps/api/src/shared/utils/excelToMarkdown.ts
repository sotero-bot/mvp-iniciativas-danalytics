import * as fs from 'fs';

export function excelToMarkdown(filePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Skip empty sheets
    const nonEmpty = rows.filter(row => row.some(c => String(c).trim() !== ''));
    if (nonEmpty.length === 0) continue;

    if (workbook.SheetNames.length > 1) {
      parts.push(`### ${sheetName}\n`);
    }

    const [header, ...dataRows] = nonEmpty;
    const cols = header.length;

    const escape = (v: any) => String(v ?? '').trim().replace(/\|/g, '\\|').replace(/\n/g, ' ');

    const headerRow  = '| ' + header.map(escape).join(' | ') + ' |';
    const separator  = '| ' + Array(cols).fill('---').join(' | ') + ' |';
    const bodyRows   = dataRows.map(row =>
      '| ' + Array.from({ length: cols }, (_, i) => escape(row[i])).join(' | ') + ' |'
    );

    parts.push([headerRow, separator, ...bodyRows].join('\n'));
  }

  return parts.join('\n\n');
}
