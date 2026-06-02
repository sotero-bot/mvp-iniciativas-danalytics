import React, { useState } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Base URL del endpoint REST que expone presign-prompt / prompt-template / prompt-url.
   *  Ej: `${API_URL}/admin/plantillas/${plantillaId}/pasos/${pasoId}/preguntas/${preguntaId}`.
   *  Si es `null` (pregunta aún sin guardar), los botones de S3 quedan deshabilitados. */
  apiBase: string | null;
}

const isS3Key = (v: string) => !!v && !v.startsWith('/') && !v.startsWith('http');

function extractFilename(s: string): string {
  if (!s) return '';
  const last = s.split('/').pop() || s;
  return last;
}

export function PromptTemplateField({ value, onChange, apiBase }: Props) {
  const [busy, setBusy] = useState<'upload' | 'delete' | 'preview' | null>(null);
  const s3Mode = isS3Key(value);

  const handleUpload = async (file: File) => {
    if (!apiBase) { alert('Guardá la pregunta primero para poder subir un prompt a S3.'); return; }
    setBusy('upload');
    try {
      const presign = await fetch(`${apiBase}/presign-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'text/markdown' }),
      });
      if (!presign.ok) throw new Error((await presign.json()).message || 'Error al solicitar presign');
      const { uploadUrl, key } = await presign.json();

      const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'text/markdown' } });
      if (!put.ok) throw new Error('Error al subir el archivo a S3');

      const patch = await fetch(`${apiBase}/prompt-template`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlPromptTemplate: key }),
      });
      if (!patch.ok) throw new Error('Error al guardar la key del prompt');
      onChange(key);
    } catch (err: any) {
      alert(err.message || 'Error al subir el prompt');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!apiBase) { onChange(''); return; }
    if (!confirm('¿Eliminar el prompt actual?')) return;
    setBusy('delete');
    try {
      const res = await fetch(`${apiBase}/prompt-template`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Error al eliminar el prompt');
      onChange('');
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el prompt');
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    if (!apiBase) return;
    setBusy('preview');
    try {
      const res = await fetch(`${apiBase}/prompt-url`);
      if (!res.ok) throw new Error('No se pudo generar el enlace');
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener');
    } catch (err: any) {
      alert(err.message || 'Error al previsualizar');
    } finally {
      setBusy(null);
    }
  };

  const inputId = React.useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {s3Mode ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6 }}>
          <span style={{ fontSize: '0.85rem', flex: 1, wordBreak: 'break-all' }}>
            <span style={{ color: '#16a34a', marginRight: 6 }}>S3</span>
            <span style={{ fontWeight: 500 }}>{extractFilename(value)}</span>
          </span>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            disabled={!apiBase || busy !== null}
            onClick={handlePreview}>
            Ver
          </button>
          <label className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', margin: 0, cursor: apiBase && busy === null ? 'pointer' : 'not-allowed' }}>
            {busy === 'upload' ? 'Subiendo…' : 'Reemplazar'}
            <input type="file" accept=".md,text/markdown,text/plain" style={{ display: 'none' }}
              disabled={!apiBase || busy !== null}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
          </label>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
            disabled={!apiBase || busy !== null}
            onClick={handleDelete}>
            {busy === 'delete' ? '…' : 'Eliminar'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
            <input id={inputId} className="input" value={value} onChange={e => onChange(e.target.value)}
              placeholder="Ej: /templates/analytics_canvas_prompt.md"
              style={{ flex: 1 }} />
            <label className="btn btn-secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', margin: 0, cursor: apiBase && busy === null ? 'pointer' : 'not-allowed' }}
              title={apiBase ? 'Subir un .md a S3 — reemplaza el path local' : 'Guardá la pregunta primero para subir un prompt propio a S3'}>
              {busy === 'upload' ? 'Subiendo…' : 'Subir .md a S3'}
              <input type="file" accept=".md,text/markdown,text/plain" style={{ display: 'none' }}
                disabled={!apiBase || busy !== null}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
            </label>
          </div>
          {!apiBase && (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Para subir un prompt propio a S3, guardá primero la pregunta.
            </span>
          )}
        </>
      )}
    </div>
  );
}
