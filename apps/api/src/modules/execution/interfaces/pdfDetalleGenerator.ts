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

    doc.end();
  });
}
