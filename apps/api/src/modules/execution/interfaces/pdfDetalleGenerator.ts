/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaService } from '../../../prisma.service';
import { renderMarkdown } from './pdfMarkdownRenderer';

export interface InstanciaDetalleData {
  id: string;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  emailReferencia?: string | null;
  actividad: {
    nombre: string;
    plantillaOrigen?: { nombre: string } | null;
    iniciativa?: { nombre: string; empresa?: { nombre: string } | null } | null;
    pasos: Array<{
      id: string;
      orden: number;
      titulo: string;
      objetivo?: string | null;
      preguntas: Array<{ id: string; orden: number; enunciado: string }>;
    }>;
  };
  usuario?: { nombre: string; email?: string | null; cargo?: string | null; area?: string | null } | null;
  respuestas: Array<{
    preguntaId: string;
    respuestaIa?: string | null;
    respuestaUsuario?: string | null;
    contenido?: string | null;
    archivoNombre?: string | null;
    archivoKey?: string | null;
    archivoMime?: string | null;
    pregunta?: { paso?: { titulo?: string; orden?: number } | null } | null;
  }>;
  interacciones: Array<{
    pasoId: string;
    contenido?: string | null;
    contenidoArchivo?: string | null;
    archivoNombre?: string | null;
    paso?: { titulo?: string } | null;
  }>;
  canvasBloques?: Array<{
    pasoId: string;
    resumen: string;
    paso?: { titulo: string; orden: number } | null;
  }>;
}

export function slugSegment(s: string): string {
  return (s || '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export async function loadInstanciaForPdf(prisma: PrismaService, id: string): Promise<InstanciaDetalleData | null> {
  return (await prisma.instanciaActividad.findUnique({
    where: { id },
    include: {
      actividad: {
        include: {
          plantillaOrigen: { select: { nombre: true } },
          iniciativa: { include: { empresa: { select: { nombre: true } } } },
          pasos: {
            orderBy: { orden: 'asc' },
            include: { preguntas: { where: { activo: true }, orderBy: { orden: 'asc' } } },
          },
        },
      },
      usuario: true,
      respuestas: {
        include: {
          pregunta: { select: { paso: { select: { titulo: true, orden: true } } } },
        },
      },
      interacciones: { include: { paso: { select: { titulo: true } } } },
      canvasBloques: { include: { paso: { select: { titulo: true, orden: true } } } },
    },
  })) as unknown as InstanciaDetalleData | null;
}

export function buildBaseFilename(instancia: InstanciaDetalleData): string {
  const empresa = instancia.actividad?.iniciativa?.empresa?.nombre || '';
  const actividad = instancia.actividad?.nombre || '';
  const usuario = instancia.usuario?.nombre || instancia.emailReferencia || '';
  return [slugSegment(empresa), slugSegment(actividad), slugSegment(usuario)].filter(Boolean).join('_') || 'Ejecucion';
}

export function buildZipFilename(instancia: InstanciaDetalleData): string {
  const empresa = instancia.actividad?.iniciativa?.empresa?.nombre || '';
  const area = instancia.usuario?.area || '';
  const actividad = instancia.actividad?.nombre || '';
  return [slugSegment(empresa), slugSegment(area), slugSegment(actividad)].filter(Boolean).join('_') || 'Ejecucion';
}

const ESTADO_LABELS: Record<string, string> = {
  generado: 'Pendiente',
  iniciado: 'En progreso',
  finalizado: 'Finalizado',
};

// ─── Analytics Canvas PDF rendering ────────────────────────────────────────

type PdfSlotKey =
    | 'datos' | 'oportunidad' | 'problema' | 'usuarios' | 'actores'
    | 'indicadores' | 'entregables' | 'restricciones' | 'valor' | 'recursos';

const PDF_CANVAS_SLOTS: Record<PdfSlotKey, { label: string; bg: string; border: string; labelColor: string; stickyBg: string }> = {
  datos:        { label: 'Datos y fuentes',        bg: '#F5F3FF', border: '#DDD6FE', labelColor: '#5B21B6', stickyBg: '#EDE9FE' },
  oportunidad:  { label: 'Oportunidad',            bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
  problema:     { label: 'Problema o reto actual', bg: '#FFF7ED', border: '#FDBA74', labelColor: '#C2410C', stickyBg: '#FED7AA' },
  usuarios:     { label: 'Usuarios',               bg: '#FDF2F8', border: '#F9A8D4', labelColor: '#9D174D', stickyBg: '#FCE7F3' },
  actores:      { label: 'Actores principales',    bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
  indicadores:  { label: 'Indicadores de éxito',   bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
  entregables:  { label: 'Entregables',            bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
  restricciones:{ label: 'Restricciones',          bg: '#FFF1F2', border: '#FECDD3', labelColor: '#BE123C', stickyBg: '#FFE4E6' },
  recursos:     { label: 'Recursos requeridos',    bg: '#F8FAFC', border: '#E2E8F0', labelColor: '#475569', stickyBg: '#F1F5F9' },
  valor:        { label: 'Potencial de valor',     bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
};

const PDF_SLOT_ORDER: PdfSlotKey[] = [
  'datos','oportunidad','problema','usuarios','actores',
  'indicadores','entregables','restricciones','recursos','valor',
];

function matchPdfSlot(titulo: string): PdfSlotKey | null {
  const t = titulo.toLowerCase();
  if (t.includes('dato') || t.includes('fuente')) return 'datos';
  if (t.includes('solución') || t.includes('solucion') || t.includes('oportunidad')) return 'oportunidad';
  if (t.includes('problema') || t.includes('reto')) return 'problema';
  if (t.includes('usuario')) return 'usuarios';
  if (t.includes('actor') || t.includes('equipo') || t.includes('responsable')) return 'actores';
  if (t.includes('kpi') || t.includes('indicador') || t.includes('éxito') || t.includes('exito')) return 'indicadores';
  if (t.includes('entregable')) return 'entregables';
  if (t.includes('barrera') || t.includes('riesgo') || t.includes('restricción') || t.includes('restriccion')) return 'restricciones';
  if (t.includes('valor') || t.includes('potencial') || t.includes('estratégico') || t.includes('estrategico')) return 'valor';
  return null;
}

function renderCanvasSection(
  doc: any,
  pasos: Array<{ id: string; titulo: string; orden: number }>,
  canvasBloques: Array<{ pasoId: string; resumen: string }>,
): void {
  doc.addPage();

  // Title
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('Lienzo de oportunidad');
  doc.moveDown(0.3);
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#4338CA').lineWidth(2).stroke();
  doc.moveDown(0.6);

  // Build slot → lines map
  const slotLines: Partial<Record<PdfSlotKey, string[]>> = {};
  for (const paso of pasos) {
    const key = matchPdfSlot(paso.titulo);
    if (!key) continue;
    const bloque = canvasBloques.find((b) => b.pasoId === paso.id);
    const raw = bloque?.resumen ?? '';
    slotLines[key] = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  }

  const gStartX = doc.page.margins.left;
  const gStartY = doc.y;
  const gap = 3;
  const usableW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // 5 columns: proportions 1,1,1.4,1,1  (total 5.4 parts)
  const unit = (usableW - gap * 4) / 5.4;
  const colW = [unit, unit, unit * 1.4, unit, unit];
  const colX = [
    gStartX,
    gStartX + colW[0] + gap,
    gStartX + colW[0] + gap + colW[1] + gap,
    gStartX + colW[0] + gap + colW[1] + gap + colW[2] + gap,
    gStartX + colW[0] + gap + colW[1] + gap + colW[2] + gap + colW[3] + gap,
  ];

  const rowH = [185, 185, 145];
  const rowY = [gStartY, gStartY + rowH[0] + gap, gStartY + rowH[0] + gap + rowH[1] + gap];

  const blockPos: Record<PdfSlotKey, { x: number; y: number; w: number; h: number }> = {
    datos:        { x: colX[0], y: rowY[0], w: colW[0],               h: rowH[0] + gap + rowH[1] },
    oportunidad:  { x: colX[1], y: rowY[0], w: colW[1],               h: rowH[0] },
    problema:     { x: colX[2], y: rowY[0], w: colW[2],               h: rowH[0] + gap + rowH[1] },
    usuarios:     { x: colX[3], y: rowY[0], w: colW[3],               h: rowH[0] },
    actores:      { x: colX[4], y: rowY[0], w: colW[4],               h: rowH[0] + gap + rowH[1] },
    indicadores:  { x: colX[1], y: rowY[1], w: colW[1],               h: rowH[1] },
    entregables:  { x: colX[3], y: rowY[1], w: colW[3],               h: rowH[1] },
    restricciones:{ x: colX[0], y: rowY[2], w: colW[0] + gap + colW[1], h: rowH[2] },
    recursos:     { x: colX[2], y: rowY[2], w: colW[2],               h: rowH[2] },
    valor:        { x: colX[3], y: rowY[2], w: colW[3] + gap + colW[4], h: rowH[2] },
  };

  for (const key of PDF_SLOT_ORDER) {
    const pos = blockPos[key];
    const cfg = PDF_CANVAS_SLOTS[key];
    const lines = slotLines[key] ?? [];

    // Background + border
    doc.save();
    doc.roundedRect(pos.x, pos.y, pos.w, pos.h, 4).fill(cfg.bg);
    doc.roundedRect(pos.x, pos.y, pos.w, pos.h, 4).lineWidth(0.5).stroke(cfg.border);
    doc.restore();

    // Label
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(cfg.labelColor)
      .text(cfg.label.toUpperCase(), pos.x + 5, pos.y + 6, { width: pos.w - 10, lineBreak: false, ellipsis: true });

    // Sticky notes
    const noteX = pos.x + 5;
    const noteW = pos.w - 10;
    const noteH = 16;
    const noteGap = 3;
    let noteY = pos.y + 18;

    if (lines.length === 0) {
      // Dashed empty area
      doc.save();
      doc.rect(noteX, noteY, noteW, pos.h - 24).dash(3, { space: 3 }).lineWidth(0.5).stroke(cfg.border);
      doc.undash();
      doc.restore();
    } else {
      for (const line of lines) {
        if (noteY + noteH > pos.y + pos.h - 4) break;
        doc.save();
        doc.roundedRect(noteX, noteY, noteW, noteH, 2).fill(cfg.stickyBg);
        doc.restore();
        doc.font('Helvetica').fontSize(6).fillColor('#1E293B')
          .text(line, noteX + 3, noteY + 4, { width: noteW - 6, lineBreak: false, ellipsis: true });
        noteY += noteH + noteGap;
      }
    }
  }

  const totalGridH = rowH[0] + gap + rowH[1] + gap + rowH[2];
  doc.x = doc.page.margins.left;
  doc.y = gStartY + totalGridH + 16;
}

// ────────────────────────────────────────────────────────────────────────────

export function generatePdfBuffer(instancia: InstanciaDetalleData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });

  const empresa = instancia.actividad?.iniciativa?.empresa?.nombre || '';
  const iniciativa = instancia.actividad?.iniciativa?.nombre || '';
  const actividad = instancia.actividad?.nombre || '';
  const usuarioNombre = instancia.usuario?.nombre || instancia.emailReferencia || 'Sin identificar';
  const area = instancia.usuario?.area || '—';
  const cargo = instancia.usuario?.cargo || '—';
  const fechaInicio = instancia.fechaInicio ? new Date(instancia.fechaInicio).toLocaleString('es-CO') : '—';
  const fechaFin = instancia.fechaFin ? new Date(instancia.fechaFin).toLocaleString('es-CO') : '—';
  const estado = ESTADO_LABELS[instancia.estado] ?? instancia.estado;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Detalle de Ejecución');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(11).fillColor('#64748b')
      .text([empresa, iniciativa, actividad].filter(Boolean).join(' · '));
    doc.moveDown(0.3);
    doc.moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#4338CA').lineWidth(2).stroke();
    doc.moveDown(0.8);

    // Metadatos — una sola columna
    const metaRows: [string, string][] = [
      ['Usuario', usuarioNombre],
      ['Estado', estado],
      ['Área', area],
      ['Cargo', cargo],
      ['Fecha de inicio', fechaInicio],
      ['Fecha de fin', fechaFin],
    ];
    doc.fontSize(10).fillColor('#334155');
    for (const [label, value] of metaRows) {
      doc.x = doc.page.margins.left;
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true })
        .font('Helvetica').text(value);
    }
    doc.moveDown(0.8);

    // Pasos
    for (const paso of instancia.actividad.pasos) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 120) doc.addPage();

      doc.x = doc.page.margins.left;
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(`${paso.orden}. ${paso.titulo}`);
      doc.moveDown(0.2);
      if (paso.objetivo) {
        doc.x = doc.page.margins.left;
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#4338CA').text(`Objetivo: ${paso.objetivo}`);
        doc.moveDown(0.3);
      }

      const preguntas = paso.preguntas ?? [];
      if (preguntas.length > 0) {
        for (let i = 0; i < preguntas.length; i++) {
          const q = preguntas[i];
          const r = instancia.respuestas.find((resp) => resp.preguntaId === q.id);
          const texto = r ? (r.respuestaIa || r.respuestaUsuario || r.contenido || '') : '';

          if (preguntas.length > 1) {
            doc.x = doc.page.margins.left;
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text(`PREGUNTA ${i + 1}`);
            doc.moveDown(0.15);
          }
          doc.x = doc.page.margins.left;
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#334155');
          renderMarkdown(doc, q.enunciado);
          doc.moveDown(0.15);

          if (texto && texto.trim()) {
            doc.x = doc.page.margins.left;
            doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
            renderMarkdown(doc, texto);
          } else {
            doc.x = doc.page.margins.left;
            doc.font('Helvetica-Oblique').fontSize(10).fillColor('#94a3b8').text('Sin respuesta de texto');
          }
          doc.moveDown(0.6);
        }
      } else {
        const inter = instancia.interacciones.find((it) => it.pasoId === paso.id);
        const texto = inter ? (inter.contenido || '') : '';
        if (texto && texto.trim()) {
          doc.x = doc.page.margins.left;
          doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
          renderMarkdown(doc, texto);
        } else {
          doc.x = doc.page.margins.left;
          doc.font('Helvetica-Oblique').fontSize(10).fillColor('#94a3b8').text('Sin respuesta de texto');
        }
        doc.moveDown(0.6);
      }

      doc.moveDown(0.4);
    }

    // Analytics Canvas section (only for canvas activities)
    if (instancia.canvasBloques && instancia.canvasBloques.length > 0) {
      renderCanvasSection(doc, instancia.actividad.pasos, instancia.canvasBloques);
    }

    doc.end();
  });
}
