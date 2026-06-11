import React, { useEffect, useState, useCallback } from 'react';
import { fetchWithErrorMapping, translateError } from '../shared/api/fetchWithErrorMapping';

const SUPPORTED_LOCALES = [
  { code: 'pt', label: '🇧🇷 PT' },
  { code: 'en', label: '🇺🇸 EN' },
];

export interface TranslationField {
  key: string;
  label: string;
  multiline?: boolean;
}

interface TranslationPanelProps {
  getUrl: (locale: string) => string;
  putUrl: (locale: string) => string;
  fields: TranslationField[];
}

export function TranslationPanel({ getUrl, putUrl, fields }: TranslationPanelProps) {
  const [locale, setLocale] = useState('pt');
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((loc: string) => {
    setLoading(true);
    setError('');
    setSaved(false);
    fetchWithErrorMapping(`${getUrl(loc)}?locale=${loc}`)
      .then(r => r.json())
      .then(data => setValues(data ?? {}))
      .catch(err => setError(translateError(err)))
      .finally(() => setLoading(false));
  }, [getUrl]);

  useEffect(() => { load(locale); }, [locale, load]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await fetchWithErrorMapping(putUrl(locale), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: '#f0f9ff',
      border: '1px solid #bae6fd',
      borderRadius: 6,
      padding: '10px 14px',
      marginTop: 4,
    }}>
      {/* Locale selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600, marginRight: 4 }}>Idioma:</span>
        {SUPPORTED_LOCALES.map(l => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code)}
            style={{
              padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600, borderRadius: 4, cursor: 'pointer',
              border: locale === l.code ? '1.5px solid #0284c7' : '1px solid #94a3b8',
              background: locale === l.code ? '#0284c7' : '#fff',
              color: locale === l.code ? '#fff' : '#64748b',
              transition: 'all 0.1s',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '6px 0' }}>Cargando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0369a1', display: 'block', marginBottom: 3 }}>
                {f.label}
              </label>
              {f.multiline ? (
                <textarea
                  className="input"
                  rows={2}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={`Traducción ${locale.toUpperCase()}…`}
                  style={{ fontSize: '0.85rem' }}
                />
              ) : (
                <input
                  className="input"
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={`Traducción ${locale.toUpperCase()}…`}
                  style={{ fontSize: '0.85rem' }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#b91c1c' }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '4px 16px', fontSize: '0.8rem' }}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Guardando…' : saved ? '✅ Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
