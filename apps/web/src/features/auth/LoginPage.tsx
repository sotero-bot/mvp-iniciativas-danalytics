import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const { t, i18n } = useTranslation(['auth']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // C-06: solicitud de magic link por correo (para usuarios sin contraseña / no-Google).
  const [magicEmail, setMagicEmail] = useState('');
  const [magicMsg, setMagicMsg] = useState('');
  const [magicError, setMagicError] = useState('');
  const [magicSending, setMagicSending] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    setMagicSending(true);
    setMagicMsg('');
    setMagicError('');
    try {
      await fetchWithErrorMapping(`${API_URL}/auth/magic-link/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail.trim(), locale: i18n.language?.startsWith('pt') ? 'pt' : 'es' }),
      });
      // C-06: si el usuario existe se envía; si no, el backend responde USUARIO_NO_REGISTRADO.
      setMagicMsg(t('auth:login_page.magic_sent'));
    } catch (err) {
      setMagicError(translateError(err));
    } finally {
      setMagicSending(false);
    }
  };

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
      toast.success(t('auth:login_page.login_success'));
      onLogin(data.access_token);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <LanguageSwitcher variant="floating" />
      {/* Left panel */}
      <div className="auth-panel">
        <div style={{ marginBottom: '3rem' }}>
          <img src="/logo-horizontal.png" alt="Danalytics Logo" style={{
            height: 48,
            marginBottom: '1.5rem',
            objectFit: 'contain'
          }} />
          <h1 style={{ color: 'white', fontSize: '1.875rem', margin: 0 }}>{t('auth:login_page.welcome')}</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>{t('auth:login_page.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="login-username" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>
              {t('auth:login_page.username_label')}
            </label>
            <input
              id="login-username"
              className="input input-on-dark"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('auth:login_page.username_placeholder')}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="login-password" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>
              {t('auth:login_page.password_label')}
            </label>
            <input
              id="login-password"
              className="input input-on-dark"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('auth:login_page.password_placeholder')}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-sm)',
              color: '#FCA5A5',
              fontSize: '0.875rem',
            }} role="alert">
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
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{t('auth:login_page.divider')}</span>
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

        {/* C-06: enlace de acceso por correo (magic link) */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <label htmlFor="login-magic-email" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>
            {t('auth:login_page.magic_label')}
          </label>
          <form onSubmit={handleMagicLink} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="login-magic-email"
              className="input input-on-dark"
              type="email"
              value={magicEmail}
              onChange={e => setMagicEmail(e.target.value)}
              placeholder={t('auth:login_page.magic_placeholder')}
              autoComplete="email"
              style={{ flex: '1 1 200px' }}
            />
            <button type="submit" className="btn" disabled={magicSending} style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}>
              {magicSending ? t('auth:login_page.submitting') : t('auth:login_page.magic_submit')}
            </button>
          </form>
          {magicMsg && (
            <div style={{ marginTop: 10, padding: '0.6rem 0.9rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-sm)', color: '#86EFAC', fontSize: '0.85rem' }} role="status">
              {magicMsg}
            </div>
          )}
          {magicError && (
            <div style={{ marginTop: 10, padding: '0.6rem 0.9rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', color: '#FCA5A5', fontSize: '0.85rem' }} role="alert">
              {magicError}
            </div>
          )}
        </div>
      </div>

      {/* Right decorative panel */}
      <div className="auth-decorative">
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1.5rem',
            opacity: 0.6,
          }}>📊</div>
          <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem', opacity: 0.9 }}>
            {t('auth:login_page.brand_name')}
          </h2>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            {t('auth:login_page.brand_tagline')}
          </p>
        </div>
      </div>
    </div>
  );
}
