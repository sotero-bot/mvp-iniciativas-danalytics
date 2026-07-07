import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

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
        const redirect = data.propositoRedirect || '/admin/inicio';
        setTimeout(() => navigate(redirect, { replace: true }), 800);
      } catch (err) {
        setStatus('error');
        setErrorMsg(translateError(err));
      }
    })();
  }, [token]);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      position: 'relative',
      padding: 24,
    }}>
      <LanguageSwitcher variant="floating" />
      <div style={{
        maxWidth: 420,
        width: '100%',
        padding: '2.5rem 2rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        textAlign: 'center',
      }}>
        <img src="/logo-horizontal.png" alt="Danalytics" style={{ height: 40, marginBottom: 24, objectFit: 'contain' }} />

        {status === 'loading' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:magic_link.processing')}</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: 8 }}>{t('auth:magic_link.wait')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:magic_link.success')}</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: 8 }}>{t('auth:magic_link.redirecting')}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:magic_link.error_title')}</h2>
            <p style={{ color: '#FCA5A5', fontSize: '0.9rem', marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>
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
