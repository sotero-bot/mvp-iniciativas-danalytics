import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { RestrictedPdfViewer } from '../../components/RestrictedPdfViewer';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Sesion {
  id: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
  urlGrabacion: string | null;
  bloqueada: boolean;
}

export function EstudianteSesionesPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['estudiante', 'common']);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [materialAbierto, setMaterialAbierto] = useState<string | null>(null);
  const [materialUrl, setMaterialUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas/${programaId}/sesiones`)
      .then((res) => res.json())
      .then(setSesiones)
      .catch((err) => setToast(translateError(err)))
      .finally(() => setLoading(false));
  }, [programaId]);

  const verMaterial = async (sesionId: string) => {
    if (materialAbierto === sesionId) {
      setMaterialAbierto(null);
      return;
    }
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/sesiones/${sesionId}/material`);
      const data = await res.json();
      setMaterialUrl(data.url);
      setMaterialAbierto(sesionId);
    } catch (err) {
      setToast(translateError(err));
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <Link to="/estudiante/programas" style={{ fontSize: '0.85rem' }}>{t('estudiante:sesiones.back')}</Link>
      <h1 style={{ fontSize: '1.4rem', margin: '0.75rem 0 1.25rem' }}>{t('estudiante:sesiones.title')}</h1>
      {toast && <div className="toast">{toast}</div>}
      {loading && <p>{t('common:loading')}</p>}
      {!loading && sesiones.length === 0 && <p>{t('estudiante:sesiones.empty')}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sesiones.map((s) => (
          <div key={s.id} className="card" style={{ padding: '1rem', opacity: s.bloqueada ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {t('estudiante:sesiones.numero', { numero: s.numeroSesion })} — {s.titulo}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {new Date(s.fechaProgramada).toLocaleDateString()}
                </div>
              </div>
              {s.bloqueada ? (
                <span style={{ fontSize: '0.8rem' }}>🔒 {t('estudiante:sesiones.locked')}</span>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => verMaterial(s.id)}>
                    📄 {t('estudiante:sesiones.material')}
                  </button>
                  {s.urlGrabacion && (
                    <a className="btn" href={s.urlGrabacion} target="_blank" rel="noreferrer">
                      🎥 {t('estudiante:sesiones.grabacion')}
                    </a>
                  )}
                </div>
              )}
            </div>
            {materialAbierto === s.id && materialUrl && (
              <div style={{ marginTop: 12 }}>
                <RestrictedPdfViewer url={materialUrl} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
