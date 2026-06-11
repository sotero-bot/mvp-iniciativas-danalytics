import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, LOCALE_FLAGS, SupportedLanguage } from '../i18n';

type Variant = 'sidebar' | 'floating' | 'header';

interface Props {
  variant?: Variant;
  className?: string;
  style?: React.CSSProperties;
}

export const LanguageSwitcher: React.FC<Props> = ({ variant = 'sidebar', className, style }) => {
  const { i18n, t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLng = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as SupportedLanguage)
    : 'es';

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value as SupportedLanguage);
  };

  const handleSelect = (lng: SupportedLanguage) => {
    void i18n.changeLanguage(lng);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Header variant: custom dropdown ── */
  if (variant === 'header') {
    return (
      <div ref={ref} style={{ position: 'relative', ...style }} className={className}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px 4px 8px',
            border: '1px solid #CBD5E1',
            borderRadius: 9999,
            background: open ? '#F1F5F9' : '#F8FAFC',
            fontSize: '0.78rem', fontWeight: 600, color: '#334155',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.15s',
          }}
        >
          <span style={{ fontSize: '0.9rem' }}>🌐</span>
          <span>{LANGUAGE_LABELS[currentLng]}</span>
          <span style={{ fontSize: '0.6rem', color: '#94A3B8', marginLeft: 2 }}>{open ? '▴' : '▾'}</span>
        </button>

        {open && (
          <div
            role="listbox"
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
              overflow: 'hidden',
              minWidth: 160,
              zIndex: 200,
            }}
          >
            {SUPPORTED_LANGUAGES.map((lng) => {
              const isActive = lng === currentLng;
              return (
                <button
                  key={lng}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => handleSelect(lng as SupportedLanguage)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '10px 14px',
                    background: isActive ? '#F0F9FF' : 'transparent',
                    border: 'none', textAlign: 'left', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#0369A1' : '#334155',
                    borderLeft: isActive ? '3px solid #0284C7' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{LOCALE_FLAGS[lng] ?? '🌐'}</span>
                  <span>{LANGUAGE_LABELS[lng as SupportedLanguage]}</span>
                  {isActive && <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ── Sidebar / floating variants: native select ── */
  const baseStyle: React.CSSProperties =
    variant === 'floating'
      ? {
          position: 'fixed', top: 14, right: 18, zIndex: 1001,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
          border: '1px solid #E2E8F0', borderRadius: 9999,
          boxShadow: '0 2px 8px rgba(15,23,42,0.08)', fontSize: '0.8rem',
        }
      : {
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 8px', color: 'var(--sidebar-text)', fontSize: '0.8rem',
        };

  const selectStyle: React.CSSProperties =
    variant === 'floating'
      ? {
          appearance: 'none', background: 'transparent', border: 'none',
          color: '#0F172A', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', paddingRight: 4,
        }
      : {
          appearance: 'none',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--sidebar-text)', fontSize: '0.8rem', borderRadius: 6,
          padding: '4px 8px', cursor: 'pointer',
        };

  return (
    <div className={className} style={{ ...baseStyle, ...style }} aria-label={t('language.label')}>
      <span aria-hidden="true" style={{ fontSize: '0.95rem' }}>🌐</span>
      <select value={currentLng} onChange={handleChange} style={selectStyle} aria-label={t('language.select')}>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>{LANGUAGE_LABELS[lng]}</option>
        ))}
      </select>
    </div>
  );
};
