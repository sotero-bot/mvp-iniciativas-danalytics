import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

type Status = 'loading' | 'success' | 'error';

/**
 * Recibe el token del backend tras el login con Google (RF-13, §1.1).
 * El backend redirige a /auth/google/callback?token=<jwt>; aquí lo guardamos
 * vía onLogin (misma vía que login y magic link) y navegamos al home.
 */
export function GoogleCallbackPage({ onLogin }: { onLogin: (token: string) => void }) {
  const { t } = useTranslation(['auth']);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    onLogin(token);
    setStatus('success');
    setTimeout(() => navigate('/', { replace: true }), 600);
  }, [params]);

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      position: 'relative', padding: 24,
    }}>
      <LanguageSwitcher variant="floating" />
      <div style={{
        maxWidth: 420, width: '100%', padding: '2.5rem 2rem',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, textAlign: 'center',
      }}>
        <img src="/logo-horizontal.png" alt="Danalytics" style={{ height: 40, marginBottom: 24, objectFit: 'contain' }} />

        {status === 'loading' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:google_callback.processing')}</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:google_callback.success')}</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: 8 }}>{t('auth:google_callback.redirecting')}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>{t('auth:google_callback.error_title')}</h2>
            <p style={{ color: '#FCA5A5', fontSize: '0.9rem', marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>
              {t('auth:google_callback.no_token')}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/login', { replace: true })} style={{ marginTop: 20 }}>
              {t('auth:google_callback.go_to_login')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
