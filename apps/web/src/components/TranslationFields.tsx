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
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderLeft: '3px solid #0284c7',
            borderRadius: 6,
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              {LOCALE_FLAGS[locale] ?? '🌐'} {t('translations.section_title')} — {(LANGUAGE_LABELS as Record<string, string>)[locale] ?? locale.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '0.82rem', color: '#0369a1', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      className="input"
                      rows={2}
                      value={values[locale]?.[f.key] ?? ''}
                      onChange={e => onChange(locale, f.key, e.target.value)}
                      placeholder={`${f.label} (${locale.toUpperCase()})…`}
                      style={{ fontSize: '0.85rem', borderColor: '#bae6fd' }}
                    />
                  ) : (
                    <input
                      className="input"
                      value={values[locale]?.[f.key] ?? ''}
                      onChange={e => onChange(locale, f.key, e.target.value)}
                      placeholder={`${f.label} (${locale.toUpperCase()})…`}
                      style={{ fontSize: '0.85rem', borderColor: '#bae6fd' }}
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
