import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type Status = 'loading' | 'success' | 'error';

export function MagicLinkConsumePage({ onLogin }: { onLogin: (token: string) => void }) {
  const { t } = useTranslation(['auth']);
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    if (!token) {
      setStatus('error');
      setErrorMsg(t('auth:magic_link.invalid'));
      return;
    }
    (async () => {
      try {
        const res = await fetchWithErrorMapping(`${API_URL}/auth/magic-link/consume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        onLogin(data.accessToken);
        setStatus('success');
        toast.success(t('auth:login_page.login_success'));
        const redirect = data.propositoRedirect || '/admin/inicio';
        setTimeout(() => navigate(redirect, { replace: true }), 800);
      } catch (err) {
        setStatus('error');
        setErrorMsg(translateError(err));
      }
    })();
  }, [token]);

  return (
    <div className="auth-layout-center">
      <LanguageSwitcher variant="floating" />
      <div className="auth-status-card" role="status" aria-live="polite">
        <img src="/logo-horizontal.png" alt="Danalytics" style={{ height: 40, marginBottom: 24, objectFit: 'contain' }} />

        {status === 'loading' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:magic_link.processing')}</h2>
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.9rem', marginTop: 8 }}>{t('auth:magic_link.wait')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:magic_link.success')}</h2>
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.9rem', marginTop: 8 }}>{t('auth:magic_link.redirecting')}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:magic_link.error_title')}</h2>
            <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem', marginTop: 12, padding: '8px 12px', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-sm)' }}>
              {errorMsg}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/login', { replace: true })}
              style={{ marginTop: 20 }}
            >
              {t('auth:magic_link.go_to_login')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
