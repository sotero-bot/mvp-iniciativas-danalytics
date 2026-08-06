import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Button, Loading, EmptyState } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { formatFechaHora } from '../../shared/formatDate';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Sesion {
  id: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
  urlPresentacion: string | null;
  presentacionArchivoUrl: string | null;
  urlGrabacion: string | null;
  timezone: string;
  bloqueada: boolean;
}

export function FacilitadorSesionesPage() {
  const { id: programaId = '' } = useParams();
  const { t, i18n } = useTranslation(['facilitador', 'common', 'admin']);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(false);
  // C-04: borrador del enlace de grabación por sesión.
  const [grabacionDraft, setGrabacionDraft] = useState<Record<string, string>>({});
  const [guardandoGrab, setGuardandoGrab] = useState<string | null>(null);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');

  const load = () => {
    setLoading(true);
    fetchWithErrorMapping(`${API_URL}/programas/${programaId}/sesiones`)
      .then((res) => res.json())
      .then(setSesiones)
      .catch((err) => toast.error(translateError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [programaId]);

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data: { id: string; nombre: string }[]) => {
        const p = data.find((x) => x.id === programaId);
        if (p) setProgramaNombre(p.nombre);
      })
      .catch(() => {});
  }, [programaId]);

  // C-04: el facilitador sube/actualiza el enlace de grabación de una sesión ya realizada.
  const guardarGrabacion = async (sesionId: string) => {
    setGuardandoGrab(sesionId);
    try {
      await fetchWithErrorMapping(`${API_URL}/facilitador/sesiones/${sesionId}/grabacion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlGrabacion: grabacionDraft[sesionId] ?? '' }),
      });
      toast.success(t('facilitador:sesiones.grabacion_guardada'));
      load();
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setGuardandoGrab(null);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: programaNombre || '—' },
          { label: t('facilitador:sesiones.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('facilitador:sesiones.title')}
      />
      {loading && <Loading label={t('common:loading')} />}
      {!loading && sesiones.length === 0 && <EmptyState title={t('facilitador:sesiones.empty')} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {sesiones.map((s) => (
          <div key={s.id} className="card" style={{ padding: 'var(--space-4)', opacity: s.bloqueada ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
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
                <div className="sesion-actions-grid">
                  {/* Acción principal de la sesión: registrar asistencia. Outline verde
                      (no navy) para no repetir un botón sólido en cada fila de la lista;
                      columna fija para que se alinee entre sesiones. */}
                  <Link className="btn btn-success" to={`/facilitador/sesiones/${s.id}/asistencia`}>
                    ✅ {t('facilitador:asistencia.title')}
                  </Link>
                  {/* Prioridad: si hay archivo subido se ofrece la descarga; si no, el enlace. */}
                  {s.presentacionArchivoUrl ? (
                    <a className="btn btn-secondary" href={s.presentacionArchivoUrl} target="_blank" rel="noreferrer">
                      📎 {t('facilitador:sesiones.presentacion_archivo')}
                    </a>
                  ) : s.urlPresentacion ? (
                    <a className="btn btn-secondary" href={s.urlPresentacion} target="_blank" rel="noreferrer">
                      🖥️ {t('facilitador:sesiones.presentacion')}
                    </a>
                  ) : (
                    <span />
                  )}
                  {s.urlGrabacion ? (
                    <a className="btn btn-secondary" href={s.urlGrabacion} target="_blank" rel="noreferrer">
                      🎥 {t('facilitador:sesiones.grabacion')}
                    </a>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </div>
            {/* C-04: subir/actualizar el enlace de grabación (solo sesiones ya realizadas). */}
            {!s.bloqueada && new Date(s.fechaProgramada).getTime() <= Date.now() && (
              <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ flex: '1 1 240px', fontSize: '0.82rem' }}
                  placeholder={t('facilitador:sesiones.grabacion_placeholder')}
                  value={grabacionDraft[s.id] ?? s.urlGrabacion ?? ''}
                  onChange={(e) => setGrabacionDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                />
                <Button
                  variant="primary"
                  disabled={guardandoGrab === s.id}
                  onClick={() => guardarGrabacion(s.id)}
                >
                  {guardandoGrab === s.id ? t('common:loading') : t('facilitador:sesiones.grabacion_guardar')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
