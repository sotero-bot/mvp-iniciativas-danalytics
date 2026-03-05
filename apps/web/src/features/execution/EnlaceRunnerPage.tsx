import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:3000';

export function EnlaceRunnerPage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const iniciarSesion = async () => {
            try {
                const res = await fetch(`${API_URL}/execution/enlace/${token}/sesion`, {
                    method: 'POST',
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setError(err.message || 'El enlace no es válido o ha sido desactivado.');
                    return;
                }

                const { instanceToken } = await res.json();
                // Redirigir al runner normal con el token de instancia personal
                navigate(`/runner/${instanceToken}`, { replace: true });
            } catch {
                setError('No se pudo conectar con el servidor. Verifica tu conexión.');
            }
        };

        iniciarSesion();
    }, [token, navigate]);

    if (error) {
        return (
            <div className="runner-layout">
                <div className="card runner-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔗</div>
                    <h2 style={{ color: '#ef4444', marginBottom: 12 }}>Enlace no disponible</h2>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="runner-center">
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                <p style={{ color: 'var(--color-text-secondary)' }}>Preparando tu sesión...</p>
            </div>
        </div>
    );
}
