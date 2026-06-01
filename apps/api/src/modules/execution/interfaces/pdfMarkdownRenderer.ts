/* eslint-disable @typescript-eslint/no-explicit-any */
// Renderiza markdown a un PDFDocument de pdfkit con soporte para:
// headings, párrafos, listas (ordenadas y no ordenadas), tablas, código, bold/italic/code inline.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { marked } = require('marked');

type InlineCtx = { bold: boolean; italic: boolean; mono: boolean };
type Segment = { text: string; bold: boolean; italic: boolean; mono: boolean };

function fontFor(s: { bold: boolean; italic: boolean; mono: boolean }): string {
  if (s.mono) return 'Courier';
  if (s.bold && s.italic) return 'Helvetica-BoldOblique';
  if (s.bold) return 'Helvetica-Bold';
  if (s.italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

function flattenInline(tokens: any[], ctx: InlineCtx = { bold: false, italic: false, mono: false }): Segment[] {
  const out: Segment[] = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case 'text':
        if (t.tokens) out.push(...flattenInline(t.tokens, ctx));
        else out.push({ text: t.text ?? '', ...ctx });
        break;
      case 'strong':
        out.push(...flattenInline(t.tokens || [], { ...ctx, bold: true }));
        break;
      case 'em':
        out.push(...flattenInline(t.tokens || [], { ...ctx, italic: true }));
        break;
      case 'codespan':
        out.push({ text: t.text ?? '', ...ctx, mono: true });
        break;
      case 'br':
        out.push({ text: '\n', ...ctx });
        break;
      case 'link':
        out.push(...flattenInline(t.tokens || [], ctx));
        break;
      case 'del':
        out.push(...flattenInline(t.tokens || [], ctx));
        break;
      default:
        if (typeof t.text === 'string') out.push({ text: t.text, ...ctx });
        else if (typeof t.raw === 'string') out.push({ text: t.raw, ...ctx });
    }
  }
  return out;
}

function renderSegments(doc: any, segments: Segment[], options: any = {}) {
  if (segments.length === 0) return;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const isLast = i === segments.length - 1;
    doc.font(fontFor(s)).text(s.text, { continued: !isLast, ...options });
  }
}

function plainTextOf(tokens: any[]): string {
  return flattenInline(tokens).map((s) => s.text).join('');
}

function ensureSpace(doc: any, neededHeight: number) {
  const limit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > limit) doc.addPage();
}

function renderTable(doc: any, token: any) {
  const headers: any[] = token.header || [];
  const rows: any[][] = token.rows || [];
  const cols = headers.length;
  if (cols === 0) return;

  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = tableWidth / cols;
  const padding = 5;

  const headerTexts = headers.map((h) => plainTextOf(h.tokens || []));
  const rowsTexts = rows.map((row) => row.map((cell) => plainTextOf(cell.tokens || [])));

  doc.font('Helvetica-Bold').fontSize(9);
  const headerHeight =
    Math.max(...headerTexts.map((t) => doc.heightOfString(t || ' ', { width: colWidth - padding * 2 }))) + padding * 2;

  ensureSpace(doc, headerHeight);
  let y = doc.y;

  // Header fill + texts + borders
  doc.save();
  doc.rect(startX, y, tableWidth, headerHeight).fillColor('#f1f5f9').fill();
  doc.restore();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
  for (let i = 0; i < cols; i++) {
    doc.text(headerTexts[i] || '', startX + i * colWidth + padding, y + padding, {
      width: colWidth - padding * 2,
      lineBreak: true,
    });
  }
  doc.strokeColor('#cbd5e1').lineWidth(0.5);
  for (let i = 0; i < cols; i++) {
    doc.rect(startX + i * colWidth, y, colWidth, headerHeight).stroke();
  }
  y += headerHeight;

  // Rows
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b');
  for (const rowTexts of rowsTexts) {
    const rowHeight =
      Math.max(
        ...rowTexts.map((t) => doc.heightOfString(t || ' ', { width: colWidth - padding * 2 })),
      ) + padding * 2;

    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    doc.font('Helvetica').fontSize(9).fillColor('#1e293b');
    for (let i = 0; i < cols; i++) {
      doc.text(rowTexts[i] || '', startX + i * colWidth + padding, y + padding, {
        width: colWidth - padding * 2,
        lineBreak: true,
      });
    }
    doc.strokeColor('#cbd5e1').lineWidth(0.5);
    for (let i = 0; i < cols; i++) {
      doc.rect(startX + i * colWidth, y, colWidth, rowHeight).stroke();
    }
    y += rowHeight;
  }

  // Reset cursor a la columna izquierda
  doc.x = startX;
  doc.y = y;
}

function renderListItems(doc: any, items: any[], ordered: boolean, start: number, depth: number) {
  const indent = 14 * depth;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const bullet = ordered ? `${start + i}. ` : '• ';

    const inlineToks: any[] = [];
    const nestedLists: any[] = [];
    for (const t of item.tokens || []) {
      if (t.type === 'text' && t.tokens) inlineToks.push(...t.tokens);
      else if (t.type === 'paragraph') inlineToks.push(...(t.tokens || []));
      else if (t.type === 'text') inlineToks.push({ type: 'text', text: t.text });
      else if (t.type === 'list') nestedLists.push(t);
    }

    const leftMargin = doc.page.margins.left + indent;
    doc.x = leftMargin;
    doc.font('Helvetica').fontSize(10).fillColor('#1e293b').text(bullet, { continued: true });
    renderSegments(doc, flattenInline(inlineToks), { indent: 0 });
    doc.moveDown(0.1);

    for (const nl of nestedLists) {
      renderListItems(doc, nl.items || [], !!nl.ordered, nl.start || 1, depth + 1);
    }
  }
  doc.x = doc.page.margins.left;
}

export function renderMarkdown(doc: any, md: string | null | undefined): void {
  if (!md || !md.trim()) return;
  doc.x = doc.page.margins.left;

  const tokens = marked.lexer(md);
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const sizes = [15, 13, 12, 11, 11, 10];
        const size = sizes[Math.min(token.depth - 1, sizes.length - 1)];
        doc.x = doc.page.margins.left;
        doc.font('Helvetica-Bold').fontSize(size).fillColor('#0f172a').text(token.text || '');
        doc.moveDown(0.25);
        break;
      }
      case 'paragraph': {
        doc.x = doc.page.margins.left;
        doc.fontSize(10).fillColor('#1e293b');
        renderSegments(doc, flattenInline(token.tokens || []));
        doc.moveDown(0.3);
        break;
      }
      case 'list': {
        doc.x = doc.page.margins.left;
        renderListItems(doc, token.items || [], !!token.ordered, token.start || 1, 0);
        doc.moveDown(0.2);
        break;
      }
      case 'table':
        renderTable(doc, token);
        doc.moveDown(0.3);
        break;
      case 'code': {
        doc.x = doc.page.margins.left;
        doc.font('Courier').fontSize(9).fillColor('#0f172a').text(token.text || '');
        doc.moveDown(0.3);
        break;
      }
      case 'blockquote': {
        doc.x = doc.page.margins.left;
        doc.fontSize(10).fillColor('#475569').font('Helvetica-Oblique').text(token.text || '');
        doc.moveDown(0.3);
        break;
      }
      case 'hr': {
        doc.x = doc.page.margins.left;
        doc.moveTo(doc.x, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor('#cbd5e1')
          .stroke();
        doc.moveDown(0.5);
        break;
      }
      case 'space':
        doc.moveDown(0.15);
        break;
      default:
        if (typeof token.text === 'string') {
          doc.x = doc.page.margins.left;
          doc.fontSize(10).fillColor('#1e293b').font('Helvetica').text(token.text);
          doc.moveDown(0.2);
        }
    }
  }
}
