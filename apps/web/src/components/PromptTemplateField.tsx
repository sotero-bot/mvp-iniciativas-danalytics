import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../shared/api/fetchWithErrorMapping';

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
  const { t } = useTranslation(['methodology', 'common']);
  const [busy, setBusy] = useState<'upload' | 'delete' | 'preview' | null>(null);
  const s3Mode = isS3Key(value);

  const handleUpload = async (file: File) => {
    if (!apiBase) { alert(t('methodology:prompt_template.save_question_first_alert')); return; }
    setBusy('upload');
    try {
      const presign = await fetchWithErrorMapping(`${apiBase}/presign-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'text/markdown' }),
      });
      const { uploadUrl, key } = await presign.json();

      const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'text/markdown' } });
      if (!put.ok) throw new Error(t('common:actions.uploading'));

      await fetchWithErrorMapping(`${apiBase}/prompt-template`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlPromptTemplate: key }),
      });
      onChange(key);
    } catch (err) {
      alert(translateError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!apiBase) { onChange(''); return; }
    if (!confirm(t('methodology:prompt_template.confirm_delete_prompt'))) return;
    setBusy('delete');
    try {
      const res = await fetch(`${apiBase}/prompt-template`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('S3_UPLOAD_FAILED');
      onChange('');
    } catch (err) {
      alert(translateError(err));
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    if (!apiBase) return;
    setBusy('preview');
    try {
      const res = await fetchWithErrorMapping(`${apiBase}/prompt-url`);
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      alert(translateError(err));
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
            <span style={{ color: '#16a34a', marginRight: 6 }}>{t('methodology:prompt_template.s3_badge')}</span>
            <span style={{ fontWeight: 500 }}>{extractFilename(value)}</span>
          </span>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            disabled={!apiBase || busy !== null}
            onClick={handlePreview}>
            {t('common:buttons.view')}
          </button>
          <label className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', margin: 0, cursor: apiBase && busy === null ? 'pointer' : 'not-allowed' }}>
            {busy === 'upload' ? t('common:actions.uploading') : t('methodology:prompt_template.replace_button')}
            <input type="file" accept=".md,text/markdown,text/plain" style={{ display: 'none' }}
              disabled={!apiBase || busy !== null}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
          </label>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
            disabled={!apiBase || busy !== null}
            onClick={handleDelete}>
            {busy === 'delete' ? '…' : t('common:buttons.delete')}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
            <input id={inputId} className="input" value={value} onChange={e => onChange(e.target.value)}
              placeholder={t('methodology:prompt_template.path_placeholder')}
              style={{ flex: 1 }} />
            <label className="btn btn-secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', margin: 0, cursor: apiBase && busy === null ? 'pointer' : 'not-allowed' }}
              title={apiBase ? t('methodology:prompt_template.upload_help_apibase') : t('methodology:prompt_template.upload_help_no_apibase')}>
              {busy === 'upload' ? t('common:actions.uploading') : t('methodology:prompt_template.upload_button')}
              <input type="file" accept=".md,text/markdown,text/plain" style={{ display: 'none' }}
                disabled={!apiBase || busy !== null}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
            </label>
          </div>
          {!apiBase && (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {t('methodology:prompt_template.save_first_note')}
            </span>
          )}
        </>
      )}
    </div>
  );
}
