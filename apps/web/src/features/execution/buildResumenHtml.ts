interface ResumenInput {
  nombreActividad: string;
  descripcionActividad?: string;
  nombreEmpresa?: string;
  logoEmpresa?: string;
  fechaInicio?: string;
  fechaFin?: string;
  usuario?: { nombre: string; email: string; cargo?: string | null; area?: string | null };
  pasos: Array<{
    id: string;
    titulo: string;
    objetivo?: string;
    usarIa?: boolean;
    preguntas?: Array<{ id: string; enunciado: string; usarIa?: boolean; soloArchivo?: boolean; permitirArchivo?: boolean }>;
  }>;
  interacciones: Array<{ pasoId: string; contenido: string; archivoNombre?: string }>;
  respuestas?: Array<{ preguntaId: string; contenido?: string; respuestaUsuario?: string; respuestaIa?: string; archivoNombre?: string; contenidoArchivo?: string }>;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const markdownTableToHtml = (md: string): string => {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let headerDone = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) {
        // Separator row — close thead, open tbody
        if (inTable) html += '</thead><tbody>';
        headerDone = true;
        continue;
      }
      if (!inTable) {
        html += '<table><thead>';
        inTable = true;
        headerDone = false;
      }
      const tag = (!headerDone) ? 'th' : 'td';
      html += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    } else {
      if (inTable) { html += '</tbody></table>'; inTable = false; headerDone = false; }
      if (trimmed.startsWith('### ')) {
        html += `<h3>${esc(trimmed.slice(4))}</h3>`;
      } else if (trimmed !== '') {
        html += `<p>${esc(trimmed)}</p>`;
      }
    }
  }
  if (inTable) html += '</tbody></table>';
  return html;
};

const renderContenido = (contenido: string) => {
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(contenido);
  if (isHtml) return contenido;
  const hasMarkdownTable = /^\|.+\|$/m.test(contenido);
  if (hasMarkdownTable) return markdownTableToHtml(contenido);
  return `<p>${esc(contenido).replace(/\n/g, '<br/>')}</p>`;
};

const fmtFecha = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '—';

export function buildResumenHtml(input: ResumenInput): string {
  const respuestasPorPregunta = new Map((input.respuestas ?? []).map(r => [r.preguntaId, r]));

  const cuerpo = input.pasos
    .map((paso, idx) => {
      const preguntas = paso.preguntas ?? [];
      const tienePreguntas = preguntas.length > 0;

      let contenidoPaso: string;
      if (tienePreguntas) {
        contenidoPaso = preguntas.map((q, qIdx) => {
          const r = respuestasPorPregunta.get(q.id);
          // Solo-archivo: el contenido del archivo subido es la respuesta canónica.
          const texto = q.soloArchivo
            ? (r?.contenidoArchivo || r?.contenido)
            : (r?.respuestaIa || r?.contenidoArchivo || r?.respuestaUsuario || r?.contenido);
          return `
            <div class="pregunta">
              ${preguntas.length > 1 ? `<div class="pregunta-num">${qIdx + 1}</div>` : ''}
              <div class="pregunta-enunciado">${esc(q.enunciado)}</div>
              ${r?.archivoNombre ? `<div class="badge-archivo">📎 ${esc(r.archivoNombre)}</div>` : ''}
              <div class="respuesta">${texto ? renderContenido(texto) : '<em style="color:#94A3B8">Sin respuesta registrada</em>'}</div>
            </div>
          `;
        }).join('');
      } else {
        // Legacy: pasos sin preguntas
        const inter = input.interacciones.find(i => i.pasoId === paso.id);
        const contenido = inter?.contenido || '';
        contenidoPaso = `
          ${inter?.archivoNombre ? `<div class="badge-archivo">📎 ${esc(inter.archivoNombre)}</div>` : ''}
          <div class="respuesta">${contenido ? renderContenido(contenido) : '<em style="color:#94A3B8">Sin respuesta registrada</em>'}</div>
        `;
      }

      return `
        <article class="paso">
          <header>
            <span class="paso-num">${idx + 1}</span>
            <div>
              <h2>${esc(paso.titulo)}</h2>
              ${paso.objetivo ? `<p class="objetivo">${esc(paso.objetivo)}</p>` : ''}
            </div>
            ${paso.usarIa ? '<span class="badge-ia">IA</span>' : ''}
          </header>
          ${contenidoPaso}
        </article>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Resumen — ${esc(input.nombreActividad)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #0F172A; max-width: 840px; margin: 0 auto; padding: 32px; background: #FAFAFA; }
  .head { display: flex; align-items: center; gap: 16px; padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; margin-bottom: 24px; }
  .head img { width: 56px; height: 56px; border-radius: 12px; object-fit: contain; border: 1px solid #E2E8F0; background: white; }
  .head h1 { margin: 0 0 4px; font-size: 1.5rem; }
  .head .sub { color: #475569; font-size: 0.9rem; }
  .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; background: white; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; font-size: 0.9rem; }
  .meta dt { color: #64748B; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .meta dd { margin: 0 0 8px; font-weight: 500; }
  .paso { background: white; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
  .paso header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
  .paso-num { width: 28px; height: 28px; border-radius: 50%; background: #2563EB; color: white; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; }
  .paso h2 { margin: 0; font-size: 1.05rem; }
  .objetivo { margin: 4px 0 0; color: #2563EB; font-style: italic; font-size: 0.85rem; }
  .badge-ia { margin-left: auto; background: #F5F3FF; color: #6D28D9; border: 1px solid #DDD6FE; padding: 2px 10px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
  .badge-archivo { display: inline-flex; align-items: center; gap: 4px; background: #F0FDF4; color: #166534; border: 1px solid #86EFAC; padding: 3px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; margin-bottom: 10px; }
  .respuesta { line-height: 1.7; color: #1E293B; }
  .respuesta p { margin: 0 0 8px; }
  .respuesta table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.85rem; }
  .respuesta th { background: #F1F5F9; font-weight: 600; text-align: left; padding: 7px 10px; border: 1px solid #CBD5E1; }
  .respuesta td { padding: 6px 10px; border: 1px solid #CBD5E1; vertical-align: top; }
  .respuesta tr:nth-child(even) td { background: #F8FAFC; }
  .respuesta h3 { font-size: 0.95rem; color: #334155; margin: 12px 0 6px; }
  .pregunta { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #F1F5F9; }
  .pregunta:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .pregunta-num { display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: #0F172A; color: white; font-size: 0.65rem; font-weight: 700; text-align: center; line-height: 20px; margin-bottom: 6px; }
  .pregunta-enunciado { font-size: 0.88rem; font-weight: 600; color: #334155; margin-bottom: 10px; }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 0.8rem; text-align: center; }
  @media print { body { background: white; padding: 0; } }
</style>
</head>
<body>
  <div class="head">
    ${input.logoEmpresa ? `<img src="${esc(input.logoEmpresa)}" alt="${esc(input.nombreEmpresa || '')}" />` : ''}
    <div>
      <h1>${esc(input.nombreActividad)}</h1>
      ${input.nombreEmpresa ? `<div class="sub">${esc(input.nombreEmpresa)}</div>` : ''}
    </div>
  </div>

  <dl class="meta">
    ${input.usuario ? `
      <div><dt>Participante</dt><dd>${esc(input.usuario.nombre)}</dd></div>
      <div><dt>Correo</dt><dd>${esc(input.usuario.email)}</dd></div>
      ${input.usuario.cargo ? `<div><dt>Cargo</dt><dd>${esc(input.usuario.cargo)}</dd></div>` : ''}
      ${input.usuario.area ? `<div><dt>Área</dt><dd>${esc(input.usuario.area)}</dd></div>` : ''}
    ` : ''}
    <div><dt>Inicio</dt><dd>${fmtFecha(input.fechaInicio)}</dd></div>
    <div><dt>Finalización</dt><dd>${fmtFecha(input.fechaFin)}</dd></div>
  </dl>

  ${cuerpo}

  <footer>Resumen generado el ${new Date().toLocaleString('es-CO')} · DAnalytics</footer>
</body>
</html>`;
}
