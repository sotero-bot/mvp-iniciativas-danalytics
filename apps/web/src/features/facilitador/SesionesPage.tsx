import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { Breadcrumb, PageHeader, Button, Loading, EmptyState, Alert, StatusBadge } from '../../components/ui';
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

interface ResumenSesionCol {
  id: string;
  numeroSesion: number;
  titulo: string;
  fechaProgramada: string;
}

interface ResumenFila {
  usuarioId: string;
  nombre: string;
  email: string;
  porSesion: Record<string, boolean>;
  porcentaje: number; // fracción 0..1
}

interface Resumen {
  sesiones: ResumenSesionCol[];
  filas: ResumenFila[];
}

export function FacilitadorSesionesPage() {
  const { id: programaId = '' } = useParams();
  const { t, i18n } = useTranslation(['facilitador', 'common', 'admin', 'errors']);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(false);
  // C-04: borrador del enlace de grabación por sesión.
  const [grabacionDraft, setGrabacionDraft] = useState<Record<string, string>>({});
  const [guardandoGrab, setGuardandoGrab] = useState<string | null>(null);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');
  // RF-03/RN-03: gracia vencida → el facilitador solo consulta, sin acciones de escritura.
  const [soloLectura, setSoloLectura] = useState(false);
  // RF-20/RF-21: resumen de asistencia (matriz sesión × participante) al final de la vista.
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [exportando, setExportando] = useState(false);

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
    setLoadingResumen(true);
    fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/asistencia/resumen`)
      .then((res) => res.json())
      .then(setResumen)
      .catch((err) => toast.error(translateError(err)))
      .finally(() => setLoadingResumen(false));
  }, [programaId]);

  const exportarAsistencia = async () => {
    setExportando(true);
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/asistencia/export`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asistencia.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setExportando(false);
    }
  };

  const pct = (fraccion: number) => `${Math.round(fraccion * 100)}%`;
  const pctColor = (fraccion: number) =>
    fraccion >= 0.8 ? 'var(--color-success-strong)' : fraccion >= 0.5 ? 'var(--color-warning-strong)' : 'var(--color-danger-strong)';

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data: { id: string; nombre: string; soloLectura?: boolean }[]) => {
        const p = data.find((x) => x.id === programaId);
        if (p) {
          setProgramaNombre(p.nombre);
          setSoloLectura(!!p.soloLectura);
        }
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
      {soloLectura && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="warning">{t('errors:PROGRAMA_GRACIA_VENCIDA')}</Alert>
        </div>
      )}
      {loading && <Loading label={t('common:loading')} />}
      {!loading && sesiones.length === 0 && <EmptyState title={t('facilitador:sesiones.empty')} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {sesiones.map((s) => {
          // La asistencia solo se puede tomar de la sesión en adelante (el backend
          // responde SESION_FUTURA si se intenta antes); acá se anticipa deshabilitando
          // el acceso en vez de dejar que el facilitador entre y se encuentre el bloqueo.
          const esFutura = new Date(s.fechaProgramada).getTime() > Date.now();
          return (
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
                      columna fija para que se alinee entre sesiones. Deshabilitada hasta
                      que la sesión ocurra. En modo solo-lectura no hay nada que registrar
                      — la asistencia ya se puede consultar en el resumen al final de la vista. */}
                  {soloLectura ? (
                    <span />
                  ) : esFutura ? (
                    <span className="chip" title={t('facilitador:asistencia.future_banner')}>
                      🕓 {t('facilitador:asistencia.title')}
                    </span>
                  ) : (
                    <Link className="btn btn-success" to={`/facilitador/sesiones/${s.id}/asistencia`}>
                      ✅ {t('facilitador:asistencia.title')}
                    </Link>
                  )}
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
            {/* C-04: subir/actualizar el enlace de grabación (solo sesiones ya realizadas;
                oculto en modo solo-lectura, donde el backend rechaza la escritura). */}
            {!soloLectura && !s.bloqueada && new Date(s.fechaProgramada).getTime() <= Date.now() && (
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
          );
        })}
      </div>

      {/* RF-20/RF-21: resumen de asistencia (matriz sesión × participante) al final
          de la vista de sesiones, con exportación a Excel. */}
      <div className="section-card" style={{ marginTop: 'var(--space-5)' }}>
        <div className="section-card-header">
          <span className="section-card-title">{t('admin:asistencia.title')}</span>
          <Button
            variant="primary"
            size="sm"
            style={{ marginLeft: 'auto' }}
            onClick={exportarAsistencia}
            disabled={exportando || !resumen || resumen.filas.length === 0}
          >
            {exportando ? t('common:loading') : t('admin:asistencia.export')}
          </Button>
        </div>
        <div className="section-card-body">
          {loadingResumen && <Loading label={t('common:loading')} />}
          {!loadingResumen && resumen && resumen.filas.length === 0 && (
            <EmptyState title={t('admin:asistencia.empty')} />
          )}
          {!loadingResumen && resumen && resumen.filas.length > 0 && (
            <div className="table-container">
              <table style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: 'var(--color-bg-card)' }}>
                      {t('admin:asistencia.participante')}
                    </th>
                    {resumen.sesiones.map(s => (
                      <th key={s.id} style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: 140 }}>
                        <div>{t('admin:asistencia.sesion_n', { n: s.numeroSesion })} · {s.titulo}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                          {new Date(s.fechaProgramada).toLocaleDateString()}
                        </div>
                      </th>
                    ))}
                    <th style={{ textAlign: 'center' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.filas.map(f => (
                    <tr key={f.usuarioId}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--color-bg-card)' }}>
                        {f.nombre}
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{f.email}</div>
                      </td>
                      {resumen.sesiones.map(s => {
                        const registrado = s.id in f.porSesion;
                        return (
                          <td key={s.id} style={{ textAlign: 'center' }}>
                            {!registrado ? (
                              <StatusBadge variant="neutral">{t('admin:asistencia.no_registrado_corto')}</StatusBadge>
                            ) : f.porSesion[s.id] ? (
                              <StatusBadge variant="success">{t('admin:asistencia.presente')}</StatusBadge>
                            ) : (
                              <StatusBadge variant="danger">{t('admin:asistencia.ausente')}</StatusBadge>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: pctColor(f.porcentaje) }}>
                        {pct(f.porcentaje)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
