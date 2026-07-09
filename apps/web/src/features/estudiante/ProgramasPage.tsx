import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Programa {
  id: string;
  nombre: string;
}

export function EstudianteProgramasPage() {
  const { t } = useTranslation(['estudiante', 'common']);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then(setProgramas)
      .catch((err) => setToast(translateError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>{t('estudiante:programas.title')}</h1>
      {toast && <div className="toast">{toast}</div>}
      {loading && <p>{t('common:loading')}</p>}
      {!loading && programas.length === 0 && <p>{t('estudiante:programas.empty')}</p>}
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {programas.map((p) => (
          <Link
            key={p.id}
            to={`/estudiante/programas/${p.id}/sesiones`}
            className="card"
            style={{ padding: '1rem', display: 'block', textDecoration: 'none' }}
          >
            <div style={{ fontWeight: 600 }}>{p.nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {t('estudiante:sesiones.title')}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
