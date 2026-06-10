import React from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, SupportedLanguage } from '../i18n';

type Variant = 'sidebar' | 'floating';

interface Props {
  variant?: Variant;
  className?: string;
  style?: React.CSSProperties;
}

export const LanguageSwitcher: React.FC<Props> = ({ variant = 'sidebar', className, style }) => {
  const { i18n, t } = useTranslation('common');

  const currentLng = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as SupportedLanguage)
    : 'es';

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as SupportedLanguage;
    void i18n.changeLanguage(next);
  };

  const baseStyle: React.CSSProperties =
    variant === 'floating'
      ? {
          position: 'fixed',
          top: 14,
          right: 18,
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #E2E8F0',
          borderRadius: 9999,
          boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
          fontSize: '0.8rem',
        }
      : {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          color: 'var(--sidebar-text)',
          fontSize: '0.8rem',
        };

  const selectStyle: React.CSSProperties =
    variant === 'floating'
      ? {
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          color: '#0F172A',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          paddingRight: 4,
        }
      : {
          appearance: 'none',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--sidebar-text)',
          fontSize: '0.8rem',
          borderRadius: 6,
          padding: '4px 8px',
          cursor: 'pointer',
        };

  return (
    <div
      className={className}
      style={{ ...baseStyle, ...style }}
      aria-label={t('language.label')}
    >
      <span aria-hidden="true" style={{ fontSize: '0.95rem' }}>🌐</span>
      <select
        value={currentLng}
        onChange={handleChange}
        style={selectStyle}
        aria-label={t('language.select')}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {LANGUAGE_LABELS[lng]}
          </option>
        ))}
      </select>
    </div>
  );
};
