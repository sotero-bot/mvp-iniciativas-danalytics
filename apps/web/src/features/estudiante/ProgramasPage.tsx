import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState } from '../../components/ui';

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
    <div className="page">
      <PageHeader title={t('estudiante:programas.title')} />
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && programas.length === 0 && <EmptyState title={t('estudiante:programas.empty')} />}
      <div className="card-grid">
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
