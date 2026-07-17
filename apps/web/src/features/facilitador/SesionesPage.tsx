import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  timezone: string;
  bloqueada: boolean;
}

export function FacilitadorSesionesPage() {
  const { id: programaId = '' } = useParams();
  const { t, i18n } = useTranslation(['facilitador', 'common']);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // C-04: borrador del enlace de grabación por sesión.
  const [grabacionDraft, setGrabacionDraft] = useState<Record<string, string>>({});
  const [guardandoGrab, setGuardandoGrab] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas/${programaId}/sesiones`)
      .then((res) => res.json())
      .then(setSesiones)
      .catch((err) => setToast(translateError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [programaId]);

  // C-04: el facilitador sube/actualiza el enlace de grabación de una sesión ya realizada.
  const guardarGrabacion = async (sesionId: string) => {
    setGuardandoGrab(sesionId);
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/sesiones/${sesionId}/grabacion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlGrabacion: grabacionDraft[sesionId] ?? '' }),
      });
      setToast(t('facilitador:sesiones.grabacion_guardada'));
      load();
    } catch (err) {
      setToast(translateError(err));
    } finally {
      setGuardandoGrab(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/facilitador/programas', label: t('facilitador:sesiones.back') }}
        title={t('facilitador:sesiones.title')}
      />
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && sesiones.length === 0 && <EmptyState title={t('facilitador:sesiones.empty')} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sesiones.map((s) => (
          <div key={s.id} className="card" style={{ padding: '1rem', opacity: s.bloqueada ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {t('facilitador:sesiones.numero', { numero: s.numeroSesion })} — {s.titulo}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {formatFechaHora(s.fechaProgramada, s.timezone, i18n.language)}
                </div>
              </div>
              {s.bloqueada ? (
                <span style={{ fontSize: '0.8rem' }}>🔒 {t('facilitador:sesiones.locked')}</span>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {s.urlPresentacion && (
                    <a className="btn btn-secondary" href={s.urlPresentacion} target="_blank" rel="noreferrer">
                      🖥️ {t('facilitador:sesiones.presentacion')}
                    </a>
                  )}
                  {s.urlGrabacion && (
                    <a className="btn btn-secondary" href={s.urlGrabacion} target="_blank" rel="noreferrer">
                      🎥 {t('facilitador:sesiones.grabacion')}
                    </a>
                  )}
                  <Link className="btn btn-secondary" to={`/facilitador/sesiones/${s.id}/asistencia`}>
                    ✅ {t('facilitador:asistencia.title')}
                  </Link>
                </div>
              )}
            </div>
            {/* C-04: subir/actualizar el enlace de grabación (solo sesiones ya realizadas). */}
            {!s.bloqueada && new Date(s.fechaProgramada).getTime() <= Date.now() && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ flex: '1 1 240px', fontSize: '0.82rem' }}
                  placeholder={t('facilitador:sesiones.grabacion_placeholder')}
                  value={grabacionDraft[s.id] ?? s.urlGrabacion ?? ''}
                  onChange={(e) => setGrabacionDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                />
                <button className="btn btn-primary" disabled={guardandoGrab === s.id} onClick={() => guardarGrabacion(s.id)}>
                  {guardandoGrab === s.id ? t('common:loading') : t('facilitador:sesiones.grabacion_guardar')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
