import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../shared/api/fetchWithErrorMapping';
import { toast } from './toast-store';

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
  const { t } = useTranslation(['common']);
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
      toast.success(t('common:translation_panel.toast_saved'));
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: 'var(--color-info-bg)',
      border: '1px solid var(--color-info-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
      marginTop: 4,
    }}>
      {/* Locale selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-info)', fontWeight: 600, marginRight: 4 }}>{t('common:language.label')}:</span>
        {SUPPORTED_LOCALES.map(l => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLocale(l.code)}
            style={{
              padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: locale === l.code ? '1.5px solid var(--color-info)' : '1px solid var(--color-border-strong)',
              background: locale === l.code ? 'var(--color-info)' : 'var(--color-bg-card)',
              color: locale === l.code ? 'var(--color-bg-card)' : 'var(--color-text-secondary)',
              transition: 'all 0.1s',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', padding: '6px 0' }}>{t('common:actions.loading')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-info)', display: 'block', marginBottom: 3 }}>
                {f.label}
              </label>
              {f.multiline ? (
                <textarea
                  className="input"
                  rows={2}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={t('common:translation_panel.placeholder', { locale: locale.toUpperCase() })}
                  style={{ fontSize: '0.85rem' }}
                />
              ) : (
                <input
                  className="input"
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={t('common:translation_panel.placeholder', { locale: locale.toUpperCase() })}
                  style={{ fontSize: '0.85rem' }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--color-danger)' }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '4px 16px', fontSize: '0.8rem' }}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? t('common:actions.saving') : saved ? t('common:translation_panel.saved_short') : t('common:buttons.save')}
        </button>
      </div>
    </div>
  );
}
