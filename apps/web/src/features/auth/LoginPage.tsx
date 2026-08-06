import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { toast } from '../../components/toast-store';
import { Alert, Button, Field } from '../../components/ui';

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

      <div className="auth-brand">
        <img src="/logo-horizontal.png" alt="Danalytics Logo" style={{ height: 44, objectFit: 'contain' }} />
        <h1>{t('auth:login_page.welcome')}</h1>
        <p>{t('auth:login_page.subtitle')}</p>
      </div>

      <div className="auth-panel">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Field label={t('auth:login_page.username_label')} htmlFor="login-username">
            <input
              id="login-username"
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('auth:login_page.username_placeholder')}
              autoComplete="username"
            />
          </Field>

          <Field label={t('auth:login_page.password_label')} htmlFor="login-password">
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('auth:login_page.password_placeholder')}
              autoComplete="current-password"
            />
          </Field>

          {error && <Alert variant="danger">{error}</Alert>}

          <Button type="submit" disabled={loading} block style={{ marginTop: 8 }}>
            {loading ? t('auth:login_page.submitting') : t('auth:login_page.submit')}
          </Button>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{t('auth:login_page.divider')}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          {/* Login con Google (OAuth2, RF-13) */}
          <button
            type="button"
            onClick={handleGoogle}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
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
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem' }}>
          <Field label={t('auth:login_page.magic_label')} htmlFor="login-magic-email">
            <form onSubmit={handleMagicLink} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                id="login-magic-email"
                className="input"
                type="email"
                value={magicEmail}
                onChange={e => setMagicEmail(e.target.value)}
                placeholder={t('auth:login_page.magic_placeholder')}
                autoComplete="email"
                style={{ flex: '1 1 200px' }}
              />
              <Button type="submit" variant="secondary" disabled={magicSending}>
                {magicSending ? t('auth:login_page.submitting') : t('auth:login_page.magic_submit')}
              </Button>
            </form>
          </Field>
          {magicMsg && <Alert variant="success">{magicMsg}</Alert>}
          {magicError && <Alert variant="danger">{magicError}</Alert>}
        </div>
      </div>
    </div>
  );
}
