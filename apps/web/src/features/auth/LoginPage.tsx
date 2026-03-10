import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        onLogin(data.access_token);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Credenciales inválidas');
      }
    } catch (err: any) {
      setError('Error de conexión. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
    }}>
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
          <h1 style={{ color: 'white', fontSize: '1.875rem', margin: 0 }}>Bienvenido</h1>
          <p style={{ color: '#64748B', marginTop: 8 }}>Inicia sesión en el panel de IAGobernanza</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
              Usuario
            </label>
            <input
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.9375rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
              Contraseña
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
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
            {loading ? 'Ingresando...' : 'Ingresar'}
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
            IAGobernanza
          </h2>
          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.7 }}>
            Plataforma para diseñar, ejecutar y monitorear actividades metodológicas empresariales con asistencia de IA.
          </p>
        </div>
      </div>
    </div>
  );
}
