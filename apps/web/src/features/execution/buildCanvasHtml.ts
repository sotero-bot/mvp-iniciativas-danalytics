interface PasoItem {
    id: string;
    titulo: string;
    orden: number;
}

interface BuildCanvasHtmlParams {
    bloques: Record<string, string>;
    pasos: PasoItem[];
    empresa: string;
    area: string;
    proyecto: string;
    fecha: string;
}

function colorByOrden(orden: number): { bg: string; border: string; label: string } {
    if (orden === 1 || orden === 2) return { bg: '#EFF6FF', border: '#BFDBFE', label: '#1D4ED8' };
    if (orden === 3 || orden === 4) return { bg: '#F5F3FF', border: '#DDD6FE', label: '#6D28D9' };
    if (orden === 5 || orden === 6) return { bg: '#ECFEFF', border: '#A5F3FC', label: '#0E7490' };
    if (orden === 7) return { bg: '#F0FDF4', border: '#A7F3D0', label: '#047857' };
    if (orden === 8) return { bg: '#FFFBEB', border: '#FDE68A', label: '#B45309' };
    if (orden === 9) return { bg: '#FFF7ED', border: '#FDBA74', label: '#C2410C' };
    if (orden === 10) return { bg: '#FFF1F2', border: '#FECDD3', label: '#BE123C' };
    return { bg: '#F8FAFC', border: '#E2E8F0', label: '#475569' };
}

function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildCanvasHtml(params: BuildCanvasHtmlParams): string {
    const { bloques, pasos, empresa, area, proyecto, fecha } = params;
    const pasosOrdenados = [...pasos].sort((a, b) => a.orden - b.orden);

    const bloquesHtml = pasosOrdenados.map((paso) => {
        const colores = colorByOrden(paso.orden);
        const resumen = bloques[paso.id] || '(Sin síntesis)';

        return `
<div class="bloque" style="background:${colores.bg};border:1px solid ${colores.border};border-radius:10px;padding:1rem;display:flex;flex-direction:column;gap:8px;min-height:140px;">
  <div class="bloque-titulo" style="font-size:0.7rem;font-weight:700;color:${colores.label};text-transform:uppercase;letter-spacing:0.06em;">
    B${paso.orden} &mdash; ${escHtml(paso.titulo)}
  </div>
  <p style="margin:0;font-size:0.875rem;color:#1E293B;line-height:1.6;flex:1;">${escHtml(resumen)}</p>
</div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Analytics Canvas — ${escHtml(proyecto)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #F8FAFC;
      color: #0F172A;
      margin: 0;
      padding: 0 1rem 3rem;
    }
    .header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255,255,255,0.97); backdrop-filter: blur(12px);
      border-bottom: 1px solid #E2E8F0;
      padding: 0.75rem 1.5rem;
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem; flex-wrap: wrap;
    }
    .header-meta { font-size: 0.8rem; color: #475569; display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .header-meta strong { color: #0F172A; }
    .header-actions { display: flex; gap: 8px; }
    .btn-action {
      padding: 6px 14px; font-size: 0.8rem; font-weight: 600;
      border-radius: 8px; cursor: pointer; border: none;
    }
    .btn-export { background: #2563EB; color: white; }
    .canvas-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.875rem;
      max-width: 1200px;
      margin: 2rem auto 0;
    }
    .footer {
      text-align: center; margin-top: 2.5rem;
      font-size: 0.75rem; color: #94A3B8;
    }
    .autosave-badge {
      font-size: 0.7rem; color: #94A3B8; transition: color 0.3s;
    }
    .autosave-badge.saved { color: #059669; }
    @media print {
      .no-print, .header-actions { display: none !important; }
      body { background: white; padding: 0; }
      .header { position: static; border: none; padding: 0.5rem 0; }
      .canvas-grid { margin-top: 1rem; }
    }
  </style>
</head>
<body>

<div class="header no-print">
  <div>
    <div style="font-size:1rem;font-weight:700;letter-spacing:-0.02em;">Analytics Canvas</div>
    <div class="header-meta">
      <span><strong>Empresa:</strong> ${escHtml(empresa)}</span>
      <span><strong>Área:</strong> ${escHtml(area)}</span>
      <span><strong>Proyecto:</strong> ${escHtml(proyecto)}</span>
      <span><strong>Fecha:</strong> ${escHtml(fecha)}</span>
    </div>
  </div>
  <div class="header-actions">
    <span class="autosave-badge" id="autosaveBadge">Guardado automático activo</span>
    <button class="btn-action btn-export" onclick="exportarTxt()">Exportar .txt</button>
  </div>
</div>

<!-- Print header (visible only on print) -->
<div style="display:none;" class="print-header">
  <h1 style="margin:0 0 0.25rem;font-size:1.25rem;">Analytics Canvas</h1>
  <div style="font-size:0.8rem;color:#475569;">
    Empresa: ${escHtml(empresa)} &bull; Área: ${escHtml(area)} &bull; Proyecto: ${escHtml(proyecto)} &bull; Fecha: ${escHtml(fecha)}
  </div>
</div>
<style>
  @media print { .print-header { display: block !important; margin-bottom: 1rem; } }
</style>

<div class="canvas-grid">
${bloquesHtml}
</div>

<div class="footer">
  Generado por Analytics Canvas &mdash; Danalytics
</div>

<script>
  // Autoguardado en localStorage cada 5s
  var STORAGE_KEY = 'canvas_${escHtml(proyecto).replace(/\s+/g, '_')}_autosave';
  function autoguardar() {
    try {
      var estado = {
        empresa: ${JSON.stringify(empresa)},
        area: ${JSON.stringify(area)},
        proyecto: ${JSON.stringify(proyecto)},
        fecha: ${JSON.stringify(fecha)},
        guardadoEn: new Date().toISOString(),
        bloques: {}
      };
      document.querySelectorAll('.bloque').forEach(function(el) {
        var titulo = el.querySelector('.bloque-titulo');
        var p = el.querySelector('p');
        if (titulo && p) {
          estado.bloques[titulo.textContent.trim()] = p.textContent.trim();
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
      var badge = document.getElementById('autosaveBadge');
      if (badge) {
        badge.textContent = 'Guardado: ' + new Date().toLocaleTimeString('es-AR');
        badge.classList.add('saved');
        setTimeout(function() { badge.classList.remove('saved'); }, 2000);
      }
    } catch(e) { /* silencioso */ }
  }
  setInterval(autoguardar, 5000);

  // Exportar a .txt
  function exportarTxt() {
    var lineas = [
      'ANALYTICS CANVAS',
      '================',
      'Empresa: ${escHtml(empresa)}',
      'Area: ${escHtml(area)}',
      'Proyecto: ${escHtml(proyecto)}',
      'Fecha: ${escHtml(fecha)}',
      '',
    ];
    document.querySelectorAll('.bloque').forEach(function(el) {
      var titulo = el.querySelector('.bloque-titulo');
      var p = el.querySelector('p');
      if (titulo && p) {
        lineas.push(titulo.textContent.trim());
        lineas.push(p.textContent.trim());
        lineas.push('');
      }
    });
    var blob = new Blob([lineas.join('\\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'canvas-${escHtml(proyecto).replace(/\s+/g, '-').toLowerCase()}.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>
</body>
</html>`;
}
