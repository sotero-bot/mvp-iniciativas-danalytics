import React from 'react';
import { useTranslation } from 'react-i18next';
import { TRANSLATABLE_LOCALES, LOCALE_FLAGS, LANGUAGE_LABELS } from '../i18n';

export interface TranslatableField {
  key: string;
  label: string;
  multiline?: boolean;
}

interface TranslationFieldsProps {
  fields: TranslatableField[];
  values: Record<string, Record<string, string>>;
  onChange: (locale: string, key: string, value: string) => void;
}

/** Renders one blue translation block per translatable locale (derived from SUPPORTED_LANGUAGES). */
export function TranslationFields({ fields, values, onChange }: TranslationFieldsProps) {
  const { t } = useTranslation('methodology');

  return (
    <>
      {TRANSLATABLE_LOCALES.map(locale => (
        <div key={locale} style={{ gridColumn: 'span 2' }}>
          <div style={{
            background: 'var(--color-info-bg)',
            border: '1px solid var(--color-info-border)',
            borderLeft: '3px solid var(--color-info)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              {LOCALE_FLAGS[locale] ?? '🌐'} {t('translations.section_title')} — {(LANGUAGE_LABELS as Record<string, string>)[locale] ?? locale.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--color-info)', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      className="input"
                      rows={2}
                      value={values[locale]?.[f.key] ?? ''}
                      onChange={e => onChange(locale, f.key, e.target.value)}
                      placeholder={`${f.label} (${locale.toUpperCase()})…`}
                      style={{ fontSize: '0.85rem', borderColor: 'var(--color-info-border)' }}
                    />
                  ) : (
                    <input
                      className="input"
                      value={values[locale]?.[f.key] ?? ''}
                      onChange={e => onChange(locale, f.key, e.target.value)}
                      placeholder={`${f.label} (${locale.toUpperCase()})…`}
                      style={{ fontSize: '0.85rem', borderColor: 'var(--color-info-border)' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/** Build empty translations state: { pt: {}, en: {}, ... } */
export function emptyTranslations(): Record<string, Record<string, string>> {
  return Object.fromEntries(TRANSLATABLE_LOCALES.map(l => [l, {}]));
}
