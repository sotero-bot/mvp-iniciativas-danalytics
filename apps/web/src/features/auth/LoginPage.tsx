import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const { t } = useTranslation(['auth']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = () => {
    // Redirección de página completa al backend (vía proxy /api → :3001).
    // El backend inicia OAuth y, tras el consentimiento, vuelve a /auth/google/callback?token=...
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      onLogin(data.access_token);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      position: 'relative',
    }}>
      <LanguageSwitcher variant="floating" />
      {/* Left panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem 4rem',
        maxWidth: 480,
      }}>
        <div style={{ marginBottom: '3rem' }}>
          <img src="/logo-horizontal.png" alt="Danalytics Logo" style={{
            height: 48,
            marginBottom: '1.5rem',
            objectFit: 'contain'
          }} />
          <h1 style={{ color: 'white', fontSize: '1.875rem', margin: 0 }}>{t('auth:login_page.welcome')}</h1>
          <p style={{ color: '#64748B', marginTop: 8 }}>{t('auth:login_page.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
              {t('auth:login_page.username_label')}
            </label>
            <input
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('auth:login_page.username_placeholder')}
              autoComplete="username"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.9375rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
              {t('auth:login_page.password_label')}
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('auth:login_page.password_placeholder')}
              autoComplete="current-password"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.9375rem' }}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6,
              color: '#FCA5A5',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 8, padding: '0.75rem', fontSize: '0.9375rem' }}
          >
            {loading ? t('auth:login_page.submitting') : t('auth:login_page.submit')}
          </button>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ color: '#64748B', fontSize: '0.8rem' }}>{t('auth:login_page.divider')}</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Login con Google (OAuth2, RF-13) */}
          <button
            type="button"
            onClick={handleGoogle}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '0.75rem', fontSize: '0.9375rem', fontWeight: 600,
              background: 'white', color: '#1F2937', border: 'none', borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            {t('auth:login_page.google')}
          </button>
        </form>
      </div>

      {/* Right decorative panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(99,102,241,0.1) 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1.5rem',
            opacity: 0.6,
          }}>📊</div>
          <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem', opacity: 0.9 }}>
            {t('auth:login_page.brand_name')}
          </h2>
          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.7 }}>
            {t('auth:login_page.brand_tagline')}
          </p>
        </div>
      </div>
    </div>
  );
}
