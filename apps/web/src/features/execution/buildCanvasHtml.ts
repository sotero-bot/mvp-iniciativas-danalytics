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
    locale?: string;
}

type SlotKey =
    | 'datos' | 'oportunidad' | 'problema' | 'usuarios' | 'actores'
    | 'indicadores' | 'entregables' | 'restricciones' | 'valor' | 'recursos';

interface SlotConfig {
    labelEs: string;
    labelPt: string;
    area: string;
    bg: string;
    border: string;
    labelColor: string;
    stickyBg: string;
}

const SLOTS: Record<SlotKey, SlotConfig> = {
    datos:        { labelEs: 'Datos y fuentes',        labelPt: 'Dados e fontes',          area: 'datos',         bg: '#F5F3FF', border: '#DDD6FE', labelColor: '#5B21B6', stickyBg: '#EDE9FE' },
    oportunidad:  { labelEs: 'Oportunidad',            labelPt: 'Oportunidade',             area: 'oportunidad',   bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
    problema:     { labelEs: 'Problema o reto actual', labelPt: 'Problema ou desafio atual',area: 'problema',      bg: '#FFF7ED', border: '#FDBA74', labelColor: '#C2410C', stickyBg: '#FED7AA' },
    usuarios:     { labelEs: 'Usuarios',               labelPt: 'Usuários',                 area: 'usuarios',      bg: '#FDF2F8', border: '#F9A8D4', labelColor: '#9D174D', stickyBg: '#FCE7F3' },
    actores:      { labelEs: 'Actores principales',    labelPt: 'Atores principais',        area: 'actores',       bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
    indicadores:  { labelEs: 'Indicadores de éxito',   labelPt: 'Indicadores de sucesso',   area: 'indicadores',   bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
    entregables:  { labelEs: 'Entregables',            labelPt: 'Entregáveis',              area: 'entregables',   bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
    restricciones:{ labelEs: 'Restricciones',          labelPt: 'Barreiras e riscos',       area: 'restricciones', bg: '#FFF1F2', border: '#FECDD3', labelColor: '#BE123C', stickyBg: '#FFE4E6' },
    recursos:     { labelEs: 'Recursos requeridos',    labelPt: 'Recursos necessários',     area: 'recursos',      bg: '#F8FAFC', border: '#E2E8F0', labelColor: '#475569', stickyBg: '#F1F5F9' },
    valor:        { labelEs: 'Potencial de valor',     labelPt: 'Potencial de valor',       area: 'valor',         bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
};

const SLOT_ORDER: SlotKey[] = [
    'datos', 'oportunidad', 'problema', 'usuarios', 'actores',
    'indicadores', 'entregables', 'restricciones', 'recursos', 'valor',
];

const ORDEN_TO_SLOT: Record<number, SlotKey> = {
    1: 'problema',
    2: 'oportunidad',
    3: 'datos',
    4: 'usuarios',
    5: 'entregables',
    6: 'actores',
    7: 'indicadores',
    8: 'restricciones',
    9: 'valor',
};

const UI: Record<string, Record<string, string>> = {
    es: {
        title:     'Lienzo de oportunidad',
        empresa:   'Empresa',
        area:      'Área',
        proyecto:  'Proyecto',
        fecha:     'Fecha',
        autosave:  'Guardado automático activo',
        export:    'Exportar .txt',
        saved:     'Guardado',
        noSynth:   '(Sin síntesis)',
        footer:    'Generado por Lienzo de oportunidad — Danalytics',
        timeLocale: 'es-AR',
        htmlLang:   'es',
    },
    pt: {
        title:     'Tela de oportunidade',
        empresa:   'Empresa',
        area:      'Área',
        proyecto:  'Projeto',
        fecha:     'Data',
        autosave:  'Salvamento automático ativo',
        export:    'Exportar .txt',
        saved:     'Salvo',
        noSynth:   '(Sem síntese)',
        footer:    'Gerado por Tela de oportunidade — Danalytics',
        timeLocale: 'pt-BR',
        htmlLang:   'pt',
    },
};

function escHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderSlotHtml(key: SlotKey, lines: string[], isPt: boolean, noSynth: string): string {
    const cfg = SLOTS[key];
    const label = isPt ? cfg.labelPt : cfg.labelEs;
    const isEmpty = lines.length === 0;

    const notesHtml = isEmpty
        ? `<div style="flex:1;border:1px dashed ${cfg.border};border-radius:6px;min-height:48px;opacity:0.5;"></div>`
        : lines.map(line =>
            `<div class="sticky-note" style="background:${cfg.stickyBg};border-radius:6px;padding:0.45rem 0.6rem;font-size:0.78rem;color:#1E293B;line-height:1.45;box-shadow:0 1px 3px rgba(0,0,0,0.08);">${escHtml(line)}</div>`
        ).join('\n');

    return `
<div class="canvas-slot" data-label="${escHtml(label)}" style="grid-area:${cfg.area};background:${cfg.bg};border:1px solid ${cfg.border};border-radius:10px;padding:0.75rem;display:flex;flex-direction:column;gap:6px;min-height:90px;">
  <div style="font-size:0.68rem;font-weight:700;color:${cfg.labelColor};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">${escHtml(label)}</div>
  <div style="display:flex;flex-direction:column;gap:5px;">
${notesHtml}
  </div>
</div>`;
}

export function buildCanvasHtml(params: BuildCanvasHtmlParams): string {
    const { bloques, pasos, empresa, area, proyecto, fecha, locale = 'es' } = params;
    const isPt = locale === 'pt';
    const ui = UI[isPt ? 'pt' : 'es'];

    // Map pasos a slots por orden (independiente del idioma)
    const slotLines: Partial<Record<SlotKey, string[]>> = {};
    for (const paso of pasos) {
        const key = ORDEN_TO_SLOT[paso.orden];
        if (!key) continue;
        const raw = bloques[paso.id] ?? '';
        slotLines[key] = raw.split('\n').map(l => l.trim()).filter(Boolean);
    }

    const slotsHtml = SLOT_ORDER.map(key =>
        renderSlotHtml(key, slotLines[key] ?? [], isPt, ui.noSynth)
    ).join('\n');

    return `<!DOCTYPE html>
<html lang="${ui.htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(ui.title)} — ${escHtml(proyecto)}</title>
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
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .btn-action {
      padding: 6px 14px; font-size: 0.8rem; font-weight: 600;
      border-radius: 8px; cursor: pointer; border: none;
    }
    .btn-export { background: #2563EB; color: white; }
    .canvas-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1.4fr 1fr 1fr;
      grid-template-rows: auto auto auto;
      grid-template-areas:
        "datos oportunidad  problema usuarios  actores"
        "datos indicadores  problema entregables actores"
        "restricciones restricciones recursos valor valor";
      gap: 0.6rem;
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
    <div style="font-size:1rem;font-weight:700;letter-spacing:-0.02em;">${escHtml(ui.title)}</div>
    <div class="header-meta">
      <span><strong>${escHtml(ui.empresa)}:</strong> ${escHtml(empresa)}</span>
      <span><strong>${escHtml(ui.area)}:</strong> ${escHtml(area)}</span>
      <span><strong>${escHtml(ui.proyecto)}:</strong> ${escHtml(proyecto)}</span>
      <span><strong>${escHtml(ui.fecha)}:</strong> ${escHtml(fecha)}</span>
    </div>
  </div>
  <div class="header-actions">
    <span class="autosave-badge" id="autosaveBadge">${escHtml(ui.autosave)}</span>
    <button class="btn-action btn-export" onclick="exportarTxt()">${escHtml(ui.export)}</button>
  </div>
</div>

<!-- Print header (visible only on print) -->
<div style="display:none;" class="print-header">
  <h1 style="margin:0 0 0.25rem;font-size:1.25rem;">${escHtml(ui.title)}</h1>
  <div style="font-size:0.8rem;color:#475569;">
    ${escHtml(ui.empresa)}: ${escHtml(empresa)} &bull; ${escHtml(ui.area)}: ${escHtml(area)} &bull; ${escHtml(ui.proyecto)}: ${escHtml(proyecto)} &bull; ${escHtml(ui.fecha)}: ${escHtml(fecha)}
  </div>
</div>
<style>
  @media print { .print-header { display: block !important; margin-bottom: 1rem; } }
</style>

<div class="canvas-grid">
${slotsHtml}
</div>

<div class="footer">
  ${escHtml(ui.footer)}
</div>

<script>
  var STORAGE_KEY = 'canvas_${escHtml(proyecto).replace(/\s+/g, '_')}_autosave';
  var SAVED_LABEL = ${JSON.stringify(ui.saved)};
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
      document.querySelectorAll('.canvas-slot').forEach(function(el) {
        var label = el.getAttribute('data-label');
        var notes = Array.from(el.querySelectorAll('.sticky-note')).map(function(n) { return n.textContent.trim(); });
        if (label) estado.bloques[label] = notes.join('\\n');
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
      var badge = document.getElementById('autosaveBadge');
      if (badge) {
        badge.textContent = SAVED_LABEL + ': ' + new Date().toLocaleTimeString(${JSON.stringify(ui.timeLocale)});
        badge.classList.add('saved');
        setTimeout(function() { badge.classList.remove('saved'); }, 2000);
      }
    } catch(e) { /* silencioso */ }
  }
  setInterval(autoguardar, 5000);

  function exportarTxt() {
    var lineas = [
      'ANALYTICS CANVAS',
      '================',
      '${escHtml(ui.empresa)}: ${escHtml(empresa)}',
      '${escHtml(ui.area)}: ${escHtml(area)}',
      '${escHtml(ui.proyecto)}: ${escHtml(proyecto)}',
      '${escHtml(ui.fecha)}: ${escHtml(fecha)}',
      '',
    ];
    document.querySelectorAll('.canvas-slot').forEach(function(el) {
      var label = el.getAttribute('data-label');
      var notes = Array.from(el.querySelectorAll('.sticky-note')).map(function(n) { return '  ' + n.textContent.trim(); });
      if (label) {
        lineas.push(label.toUpperCase());
        if (notes.length > 0) {
          notes.forEach(function(n) { lineas.push(n); });
        } else {
          lineas.push('  ${escHtml(ui.noSynth)}');
        }
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
