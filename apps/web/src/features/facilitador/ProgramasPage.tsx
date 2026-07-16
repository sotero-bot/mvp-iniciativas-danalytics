import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Programa {
  id: string;
  nombre: string;
  estado: 'borrador' | 'activo' | 'finalizado' | 'cancelado';
  fechaInicio: string | null;
  fechaFin: string | null;
}

export function FacilitadorProgramasPage() {
  const { t } = useTranslation(['facilitador', 'formularios', 'common']);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setProgramas(data); })
      .catch((err) => { if (!cancelled) setToast(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page">
      <PageHeader title={t('facilitador:programas.title')} />
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && programas.length === 0 && <EmptyState title={t('facilitador:programas.empty')} />}
      <div className="card-grid">
        {programas.map((p) => (
          <div key={p.id} className="card" style={{ padding: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              {t(`facilitador:programas.estado.${p.estado}`)}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <Link to={`/facilitador/programas/${p.id}/sesiones`}>{t('facilitador:sesiones.title')}</Link>
              <Link to={`/facilitador/programas/${p.id}/grupos`}>{t('facilitador:grupos.title')}</Link>
              <Link to={`/facilitador/programas/${p.id}/observaciones`}>{t('facilitador:observaciones.title')}</Link>
              <Link to={`/facilitador/programas/${p.id}/resultados`}>{t('formularios:resultados.title')}</Link>
              <Link to={`/facilitador/programas/${p.id}/reto`}>{t('formularios:reto.title')}</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
