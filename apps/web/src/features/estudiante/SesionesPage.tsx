import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, EmptyState } from '../../components/ui';
import { formatFechaHora } from '../../shared/formatDate';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Sesion {
  id: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
  urlPresentacion: string | null;
  urlGrabacion: string | null;
  facilitadores: { id: string; nombre: string }[];
  timezone: string;
  bloqueada: boolean;
  desbloqueaEn: string;
}

export function EstudianteSesionesPage() {
  const { id: programaId = '' } = useParams();
  const { t, i18n } = useTranslation(['estudiante', 'common']);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas/${programaId}/sesiones`)
      .then((res) => res.json())
      .then(setSesiones)
      .catch((err) => setToast(translateError(err)))
      .finally(() => setLoading(false));
  }, [programaId]);

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/estudiante/programas', label: t('estudiante:sesiones.back') }}
        title={t('estudiante:sesiones.title')}
      />
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && sesiones.length === 0 && <EmptyState title={t('estudiante:sesiones.empty')} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sesiones.map((s) => (
          <div key={s.id} className="card" style={{ padding: '1rem', opacity: s.bloqueada ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {t('estudiante:sesiones.numero', { numero: s.numeroSesion })} — {s.titulo}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {formatFechaHora(s.fechaProgramada, s.timezone, i18n.language)}
                </div>
                {s.facilitadores.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {t('estudiante:sesiones.facilitador')}: {s.facilitadores.map((f) => f.nombre).join(', ')}
                  </div>
                )}
              </div>
              {s.bloqueada ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  🔒 {t('estudiante:sesiones.se_desbloquea', {
                    fecha: formatFechaHora(s.desbloqueaEn, s.timezone, i18n.language),
                  })}
                </span>
              ) : s.urlPresentacion || s.urlGrabacion ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {s.urlPresentacion && (
                    <a className="btn" href={s.urlPresentacion} target="_blank" rel="noreferrer">
                      🖥️ {t('estudiante:sesiones.presentacion')}
                    </a>
                  )}
                  {s.urlGrabacion && (
                    <a className="btn" href={s.urlGrabacion} target="_blank" rel="noreferrer">
                      🎥 {t('estudiante:sesiones.grabacion')}
                    </a>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {t('estudiante:sesiones.sin_recursos')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
