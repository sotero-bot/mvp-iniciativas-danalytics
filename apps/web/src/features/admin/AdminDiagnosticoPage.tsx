import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { BarrasDimensiones } from '../facilitador/ResultadosPage';
import { PageHeader, StatusBadge, Loading } from '../../components/ui';
import { toast } from '../../components/toast-store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ScoreDimension {
  total: number;
  promedio: number;
  respondidas: number;
}

interface Individual {
  usuario: { id: string; nombre: string; email: string };
  scores: Record<string, ScoreDimension> | null;
  enviadoEn: string | null;
}

interface Bloque {
  totalRespuestas: number;
  dimensiones: { dimension: string; promedio: number; n: number }[];
  individuales: Individual[];
}

interface Detalle {
  inicial: Bloque;
  final: Bloque;
  comparativo: { dimension: string; inicial: number | null; final: number | null }[];
}

interface SnapshotEstado {
  id: string;
  tipoFormulario: string;
  nombre: string;
  version: number;
  snapshotEn: string;
  respuestas: number;
  desactualizado: boolean;
}

// RF-34/RN-07: SOLO admin — individuales, comparativo inicial vs. final y export.
// RF-49: estado del snapshot por tipo con indicador de "versión anterior".
export function AdminDiagnosticoPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['formularios', 'common']);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotEstado[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [det, snap] = await Promise.all([
        fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/diagnostico`).then(r => r.json()),
        fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/snapshot-estado`).then(r => r.json()),
      ]);
      setDetalle(det);
      setSnapshots(snap);
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoading(false);
    }
  }, [programaId]);

  useEffect(() => {
    load();
  }, [load]);

  const exportar = async () => {
    try {
      const res = await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/diagnostico?export=xlsx`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagnostico.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const regenerar = async () => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/regenerar-snapshot`, { method: 'POST' });
      toast.success(t('formularios:resultados.snapshot.regenerado'));
      await load();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  // Rellena los tipos que faltan en el snapshot (aditivo, no toca los existentes ni
  // sus respuestas): útil cuando se creó un global nuevo después de activar el programa.
  const sincronizar = async () => {
    try {
      const { creados } = await fetchWithErrorMapping(
        `${API_URL}/admin/programas/${programaId}/sincronizar-plantillas`,
        { method: 'POST' },
      ).then(r => r.json());
      toast.success(t('formularios:resultados.snapshot.sincronizado', { count: creados }));
      await load();
    } catch (err) {
      toast.error(translateError(err));
    }
  };

  const dimensiones = detalle
    ? [...new Set([...detalle.inicial.dimensiones, ...detalle.final.dimensiones].map(d => d.dimension))].sort()
    : [];

  return (
    <div style={{ padding: '2rem', maxWidth: 960 }}>
      <PageHeader
        back={{ to: '/admin/programas', label: t('formularios:resultados.back') }}
        title={t('formularios:resultados.diagnostico')}
        actions={<button className="btn" onClick={exportar}>⬇ {t('formularios:resultados.export')}</button>}
      />
      {loading && <Loading label={t('common:loading')} />}

      {/* RF-49: snapshot por tipo */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('formularios:resultados.snapshot.title')}</h2>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {/* Aditivo y seguro: rellena tipos faltantes sin tocar los existentes. */}
            {!loading && (
              <button className="btn-link" onClick={sincronizar}>
                ＋ {t('formularios:resultados.snapshot.sincronizar')}
              </button>
            )}
            {/* Visible también sin snapshot (programas activados antes de crear los
                templates globales): el mismo endpoint lo genera desde cero (RF-47). */}
            {snapshots.every(s => s.respuestas === 0) && !loading && (
              <button className="btn-link" onClick={regenerar}>
                ↻ {snapshots.length === 0
                  ? t('formularios:resultados.snapshot.generar')
                  : t('formularios:resultados.snapshot.regenerar')}
              </button>
            )}
          </div>
        </div>
        {snapshots.length === 0 && !loading && (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {t('formularios:resultados.snapshot.empty')}
          </p>
        )}
        {snapshots.map(s => (
          <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.85rem', padding: '6px 0', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, minWidth: 180 }}>{t(`formularios:tipos.${s.tipoFormulario}`)}</span>
            <span>{s.nombre} · v{s.version}</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {t('formularios:resultados.snapshot.fecha')}: {new Date(s.snapshotEn).toLocaleDateString()}
            </span>
            <span>{t('formularios:builder.respuestas', { count: s.respuestas })}</span>
            {s.desactualizado ? (
              <StatusBadge variant="warning">
                {t('formularios:resultados.snapshot.desactualizado')}
              </StatusBadge>
            ) : (
              <StatusBadge variant="success">
                {t('formularios:resultados.snapshot.al_dia')}
              </StatusBadge>
            )}
          </div>
        ))}
      </div>

      {detalle && (
        <>
          {/* Comparativo (RF-34) */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('formularios:resultados.comparativo')}</h2>
            {detalle.comparativo.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{t('formularios:resultados.sin_datos')}</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('formularios:resultados.dimension')}</th>
                      <th>{t('formularios:resultados.inicial')}</th>
                      <th>{t('formularios:resultados.final')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.comparativo.map(fila => (
                      <tr key={fila.dimension}>
                        <td style={{ textTransform: 'capitalize' }}>{fila.dimension}</td>
                        <td>{fila.inicial?.toFixed(2) ?? '—'}</td>
                        <td style={{ fontWeight: 600 }}>{fila.final?.toFixed(2) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Agregados + individuales por momento */}
          {([['inicial', detalle.inicial], ['final', detalle.final]] as const).map(([key, bloque]) => (
            <div key={key} className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>
                {t(`formularios:resultados.${key}`)} · {bloque.totalRespuestas} {t('formularios:resultados.n').toLowerCase()}
              </h2>
              {bloque.dimensiones.length > 0 && <BarrasDimensiones dimensiones={bloque.dimensiones} />}
              {bloque.individuales.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>
                    {t('formularios:resultados.individuales')}
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('formularios:resultados.participante')}</th>
                          <th>{t('formularios:resultados.enviado')}</th>
                          {dimensiones.map(d => (
                            <th key={d} style={{ textTransform: 'capitalize' }}>{d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bloque.individuales.map(ind => (
                          <tr key={ind.usuario.id}>
                            <td>
                              {ind.usuario.nombre}
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{ind.usuario.email}</div>
                            </td>
                            <td>
                              {ind.enviadoEn ? new Date(ind.enviadoEn).toLocaleDateString() : '—'}
                            </td>
                            {dimensiones.map(d => (
                              <td key={d}>
                                {ind.scores?.[d]?.promedio?.toFixed(2) ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
