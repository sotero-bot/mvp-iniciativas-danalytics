import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function EnlaceRunnerPage() {
    const { t } = useTranslation(['execution']);
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const lang = searchParams.get('lang');
    const [error, setError] = useState('');
    const hasStarted = useRef(false);

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;

        const iniciarSesion = async () => {
            try {
                const res = await fetchWithErrorMapping(`${API_URL}/execution/enlace/${token}/sesion`, {
                    method: 'POST',
                });

                const { instanceToken } = await res.json();
                // Redirigir al runner normal con el token de instancia personal
                navigate(`/runner/${instanceToken}${lang ? `?lang=${lang}` : ''}`, { replace: true });
            } catch (err) {
                setError(translateError(err));
            }
        };

        iniciarSesion();
    }, [token, navigate, t]);

    if (error) {
        return (
            <div className="runner-layout">
                <div className="card runner-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔗</div>
                    <h2 style={{ color: '#ef4444', marginBottom: 12 }}>{t('execution:enlace_runner.error_title', { defaultValue: 'Enlace no disponible' })}</h2>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="runner-center">
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                <p style={{ color: 'var(--color-text-secondary)' }}>{t('execution:enlace_runner.preparing', { defaultValue: 'Preparando tu sesión...' })}</p>
            </div>
        </div>
    );
}
