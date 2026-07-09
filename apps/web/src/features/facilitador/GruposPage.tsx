import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Grupo {
  id: string;
  nombre: string;
  miembros: { id: string; usuario: { id: string; nombre: string; email: string } }[];
}

export function FacilitadorGruposPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['facilitador', 'common']);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/grupos`)
      .then((res) => res.json())
      .then(setGrupos)
      .catch((err) => setToast(translateError(err)))
      .finally(() => setLoading(false));
  }, [programaId]);

  return (
    <div style={{ padding: '2rem' }}>
      <Link to="/facilitador/programas" style={{ fontSize: '0.85rem' }}>{t('facilitador:sesiones.back')}</Link>
      <h1 style={{ fontSize: '1.4rem', margin: '0.75rem 0 1.25rem' }}>{t('facilitador:grupos.title')}</h1>
      {toast && <div className="toast">{toast}</div>}
      {loading && <p>{t('common:loading')}</p>}
      {!loading && grupos.length === 0 && <p>{t('facilitador:grupos.empty')}</p>}
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {grupos.map((g) => (
          <div key={g.id} className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{g.nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              {t('facilitador:grupos.miembros')}
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
              {g.miembros.map((m) => (
                <li key={m.id}>{m.usuario.nombre}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
