import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { BarrasDimensiones } from '../facilitador/ResultadosPage';

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
  const [toast, setToast] = useState<string | null>(null);

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
      setToast(translateError(err));
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
      setToast(translateError(err));
    }
  };

  const regenerar = async () => {
    try {
      await fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}/regenerar-snapshot`, { method: 'POST' });
      setToast(t('formularios:resultados.snapshot.regenerado'));
      await load();
    } catch (err) {
      setToast(translateError(err));
    }
  };

  const dimensiones = detalle
    ? [...new Set([...detalle.inicial.dimensiones, ...detalle.final.dimensiones].map(d => d.dimension))].sort()
    : [];

  return (
    <div style={{ padding: '2rem', maxWidth: 960 }}>
      <Link to="/admin/programas" style={{ fontSize: '0.85rem' }}>{t('formularios:resultados.back')}</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.4rem', margin: '0.75rem 0 1.25rem' }}>
          {t('formularios:resultados.diagnostico')}
        </h1>
        <button className="btn" onClick={exportar}>⬇ {t('formularios:resultados.export')}</button>
      </div>
      {toast && <div className="toast">{toast}</div>}
      {loading && <p>{t('common:loading')}</p>}

      {/* RF-49: snapshot por tipo */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('formularios:resultados.snapshot.title')}</h2>
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
              <span style={{ padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#B45309' }}>
                {t('formularios:resultados.snapshot.desactualizado')}
              </span>
            ) : (
              <span style={{ padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#15803D' }}>
                {t('formularios:resultados.snapshot.al_dia')}
              </span>
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
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748B' }}>
                    <th style={{ padding: '6px 10px' }}>{t('formularios:resultados.dimension')}</th>
                    <th style={{ padding: '6px 10px' }}>{t('formularios:resultados.inicial')}</th>
                    <th style={{ padding: '6px 10px' }}>{t('formularios:resultados.final')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.comparativo.map(fila => (
                    <tr key={fila.dimension} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{fila.dimension}</td>
                      <td style={{ padding: '6px 10px' }}>{fila.inicial?.toFixed(2) ?? '—'}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{fila.final?.toFixed(2) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <div style={{ marginTop: 14, overflowX: 'auto' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>
                    {t('formularios:resultados.individuales')}
                  </div>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748B' }}>
                        <th style={{ padding: '6px 10px' }}>{t('formularios:resultados.participante')}</th>
                        <th style={{ padding: '6px 10px' }}>{t('formularios:resultados.enviado')}</th>
                        {dimensiones.map(d => (
                          <th key={d} style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bloque.individuales.map(ind => (
                        <tr key={ind.usuario.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '6px 10px' }}>
                            {ind.usuario.nombre}
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{ind.usuario.email}</div>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            {ind.enviadoEn ? new Date(ind.enviadoEn).toLocaleDateString() : '—'}
                          </td>
                          {dimensiones.map(d => (
                            <td key={d} style={{ padding: '6px 10px' }}>
                              {ind.scores?.[d]?.promedio?.toFixed(2) ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
