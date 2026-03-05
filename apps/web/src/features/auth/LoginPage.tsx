import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError(errData.message || res.statusText || 'Credenciales inválidas');
      }
    } catch (err: any) {
      console.error('FETCH ERROR:', err);
      // Forzar la visualización en pantalla y en un popup para que el usuario pueda enviarnos pantallazo.
      const errorMsg = `Error de red: ${err?.message || JSON.stringify(err) || String(err)}`;
      setError(errorMsg);
      alert(errorMsg);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--color-bg-page)'
    }}>
      <div className="card" style={{ width: 350 }}>
        <h2 style={{ textAlign: 'center', color: 'var(--color-primary)', marginBottom: 20 }}>Danalytics Admin</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9em' }}>Usuario</label>
            <input
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Usuario"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9em' }}>Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>

          {error && <div style={{ color: 'red', fontSize: '0.9em', textAlign: 'center' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>Ingresar</button>
        </form>
      </div>
    </div>
  );
}
