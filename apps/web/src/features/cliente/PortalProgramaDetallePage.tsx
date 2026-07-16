import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { BarrasDimensiones } from '../facilitador/ResultadosPage';
import { PageHeader, Loading, StatCard, ProgressBar } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface DimensionAgregada { dimension: string; promedio: number; n: number }
interface BloqueDiagnostico { totalRespuestas: number; dimensiones: DimensionAgregada[] }

interface Detalle {
  programa: {
    id: string; nombre: string; descripcion: string | null;
    estado: string; fechaInicio: string | null; fechaFin: string | null;
    facilitadores: string[];
  };
  avance: { sesionesCompletadas: number; sesionesTotales: number; participantesActivos: number };
  sesiones: { id: string; numeroSesion: number; titulo: string; fechaProgramada: string; estado: string }[];
  asistencia: { registros: number; porcentajePromedio: number | null };
  proyecto: {
    id: string; nombre: string; orden: number; miembros: number;
    presentacion: { entregada: boolean; entregadoEn?: string | null; urlPresentacion?: string | null; conArchivo?: boolean };
  }[];
  diagnostico: { inicial: BloqueDiagnostico; final: BloqueDiagnostico };
  feedback: {
    totalRespuestas: number;
    campos: {
      campoId: string; etiqueta: string; tipoCampo: string; n: number;
      promedio?: number | null;
      opciones?: { valor: string; etiqueta: string; conteo: number }[];
      textos?: string[];
    }[];
  };
}

interface ResumenAsistencia {
  sesiones: { id: string; numeroSesion: number }[];
  filas: { usuarioId: string; nombre: string; email: string; porSesion: Record<string, boolean>; porcentaje: number }[];
}

// RF-43: detalle del programa para el cliente — avance, asistencia, diagnóstico
// agregado, proyecto y feedback. Todo SOLO lectura, sin export (RN-07).
export function PortalProgramaDetallePage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['portal', 'common']);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [asistencia, setAsistencia] = useState<ResumenAsistencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/portal/programas/${programaId}`).then(r => r.json()),
      // RF-20: la matriz detallada la sirve el endpoint de resumen (admite roles cliente).
      fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/asistencia/resumen`)
        .then(r => r.json())
        .catch(() => null),
    ])
      .then(([det, res]) => {
        if (cancelled) return;
        setDetalle(det);
        setAsistencia(res);
      })
      .catch(err => { if (!cancelled) setToast(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId]);

  const fecha = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString() : '—');

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}
      {detalle && (
        <>
          <PageHeader
            back={{ to: '/portal/programas', label: t('portal:detalle.back') }}
            title={detalle.programa.nombre}
            description={
              <>
                {t(`portal:programas.estado.${detalle.programa.estado}`)} · {fecha(detalle.programa.fechaInicio)} – {fecha(detalle.programa.fechaFin)}
                {detalle.programa.facilitadores.length > 0 && <> · {t('portal:programas.facilitador')}: {detalle.programa.facilitadores.join(', ')}</>}
              </>
            }
          />

          {/* Avance */}
          <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
            {[
              { label: t('portal:detalle.sesiones_completadas'), valor: `${detalle.avance.sesionesCompletadas}/${detalle.avance.sesionesTotales}` },
              { label: t('portal:detalle.participantes_activos'), valor: String(detalle.avance.participantesActivos) },
              {
                label: t('portal:detalle.asistencia_promedio'),
                valor: detalle.asistencia.porcentajePromedio == null ? '—' : `${Math.round(detalle.asistencia.porcentajePromedio * 100)}%`,
              },
            ].map(kpi => (
              <StatCard key={kpi.label} label={kpi.label} value={kpi.valor} />
            ))}
          </div>

          {/* Asistencia (matriz sesión × participante, RF-20) */}
          {asistencia && asistencia.filas.length > 0 && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('portal:detalle.asistencia')}</h2>
              <div className="table-container">
                <table className="table-compact">
                  <thead>
                    <tr>
                      <th>{t('portal:detalle.participante')}</th>
                      {asistencia.sesiones.map(s => (
                        <th key={s.id} style={{ textAlign: 'center' }}>S{s.numeroSesion}</th>
                      ))}
                      <th style={{ textAlign: 'right' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistencia.filas.map(f => (
                      <tr key={f.usuarioId}>
                        <td>{f.nombre}</td>
                        {asistencia.sesiones.map(s => (
                          <td key={s.id} style={{ textAlign: 'center' }}>
                            {f.porSesion[s.id] ? '✓' : f.porSesion[s.id] === false ? '✗' : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{Math.round(f.porcentaje * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Diagnóstico agregado (RF-35) */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('portal:detalle.diagnostico')}</h2>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {([['inicial', detalle.diagnostico.inicial], ['final', detalle.diagnostico.final]] as const).map(([key, bloque]) => (
                <div key={key}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
                    {t(`portal:detalle.${key}`)} · n={bloque.totalRespuestas}
                  </div>
                  {bloque.dimensiones.length === 0
                    ? <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{t('portal:detalle.sin_datos')}</p>
                    : <BarrasDimensiones dimensiones={bloque.dimensiones} />}
                </div>
              ))}
            </div>
          </div>

          {/* Proyecto por grupo (estado de la presentación final) */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('portal:detalle.proyecto')}</h2>
            {detalle.proyecto.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{t('portal:detalle.sin_datos')}</p>
            )}
            {detalle.proyecto.map(g => (
              <div key={g.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0', fontSize: '0.85rem', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 600, minWidth: 160 }}>{g.nombre}</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{g.miembros} {t('portal:detalle.integrantes')}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {g.presentacion.entregada ? (
                    <span style={{ color: 'var(--color-success-strong)', fontWeight: 600 }}>
                      ✓ {t('portal:detalle.presentacion_entregada')}{g.presentacion.entregadoEn ? ` · ${fecha(g.presentacion.entregadoEn)}` : ''}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-secondary)' }}>{t('portal:detalle.presentacion_pendiente')}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Feedback anónimo agregado */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('portal:detalle.feedback')}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{t('portal:detalle.feedback_hint')}</p>
            {detalle.feedback.totalRespuestas === 0 && <p style={{ fontSize: '0.85rem' }}>{t('portal:detalle.sin_datos')}</p>}
            {detalle.feedback.campos.map(campo => (
              <div key={campo.campoId} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{campo.etiqueta}</div>
                {campo.promedio !== undefined && campo.promedio !== null && (
                  <div style={{ fontSize: '0.85rem' }}>{t('portal:detalle.promedio')}: <strong>{campo.promedio.toFixed(2)}</strong> (n={campo.n})</div>
                )}
                {campo.opciones?.map(op => (
                  <div key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', marginTop: 4 }}>
                    <span style={{ minWidth: 160 }}>{op.etiqueta}</span>
                    <div style={{ flex: 1 }}>
                      <ProgressBar value={campo.n ? (op.conteo / campo.n) * 100 : 0} color="#14B8A6" label={op.etiqueta} />
                    </div>
                    <span style={{ minWidth: 24, textAlign: 'right' }}>{op.conteo}</span>
                  </div>
                ))}
                {campo.textos && campo.textos.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem' }}>
                    {campo.textos.map((texto, i) => <li key={i} style={{ marginBottom: 4 }}>{texto}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
