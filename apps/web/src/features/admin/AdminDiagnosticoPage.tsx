import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { BarrasDimensiones } from '../facilitador/ResultadosPage';
import { PageHeader, Breadcrumb, Button, StatusBadge, DataTable, Loading } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
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
  const { t } = useTranslation(['formularios', 'common', 'admin']);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotEstado[]>([]);
  const [loading, setLoading] = useState(false);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/admin/programas/${programaId}`)
      .then((res) => res.json())
      .then((p: { nombre: string }) => setProgramaNombre(p.nombre))
      .catch(() => {});
  }, [programaId]);

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

  const comparativoColumns: DataTableColumn<Detalle['comparativo'][number]>[] = [
    { key: 'dimension', header: t('formularios:resultados.dimension'), render: fila => <span style={{ textTransform: 'capitalize' }}>{fila.dimension}</span> },
    { key: 'inicial', header: t('formularios:resultados.inicial'), render: fila => fila.inicial?.toFixed(2) ?? '—' },
    { key: 'final', header: t('formularios:resultados.final'), render: fila => <strong>{fila.final?.toFixed(2) ?? '—'}</strong> },
  ];

  const individualColumns: DataTableColumn<Individual>[] = [
    {
      key: 'participante',
      header: t('formularios:resultados.participante'),
      render: ind => (
        <>
          {ind.usuario.nombre}
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{ind.usuario.email}</div>
        </>
      ),
    },
    {
      key: 'enviado',
      header: t('formularios:resultados.enviado'),
      render: ind => (ind.enviadoEn ? new Date(ind.enviadoEn).toLocaleDateString() : '—'),
    },
    ...dimensiones.map(d => ({
      key: d,
      header: <span style={{ textTransform: 'capitalize' }}>{d}</span>,
      render: (ind: Individual) => ind.scores?.[d]?.promedio?.toFixed(2) ?? '—',
    })),
  ];

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.programas'), to: '/admin/programas' },
          { label: programaNombre || programaId },
          { label: t('formularios:resultados.diagnostico') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('formularios:resultados.diagnostico')}
        actions={<Button variant="primary" onClick={exportar}>{t('formularios:resultados.export')}</Button>}
      />
      {loading && <Loading label={t('common:loading')} />}

      {/* RF-49: snapshot por tipo */}
      <div className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="section-card-header">
          <span className="section-card-title" style={{ flex: 1 }}>{t('formularios:resultados.snapshot.title')}</span>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {/* Aditivo y seguro: rellena tipos faltantes sin tocar los existentes. */}
            {!loading && (
              <Button variant="link" onClick={sincronizar}>
                {t('formularios:resultados.snapshot.sincronizar')}
              </Button>
            )}
            {/* Visible también sin snapshot (programas activados antes de crear los
                templates globales): el mismo endpoint lo genera desde cero (RF-47). */}
            {snapshots.every(s => s.respuestas === 0) && !loading && (
              <Button variant="link" onClick={regenerar}>
                {snapshots.length === 0
                  ? t('formularios:resultados.snapshot.generar')
                  : t('formularios:resultados.snapshot.regenerar')}
              </Button>
            )}
          </div>
        </div>
        <div className="section-card-body">
          {snapshots.length === 0 && !loading && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {t('formularios:resultados.snapshot.empty')}
            </p>
          )}
          {snapshots.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', fontSize: '0.85rem', padding: 'var(--space-2) 0', flexWrap: 'wrap' }}>
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
      </div>

      {detalle && (
        <>
          {/* Comparativo (RF-34) */}
          <div className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="section-card-header">
              <span className="section-card-title">{t('formularios:resultados.comparativo')}</span>
            </div>
            <div className="section-card-body">
              <DataTable
                columns={comparativoColumns}
                rows={detalle.comparativo}
                rowKey={fila => fila.dimension}
                emptyMessage={t('formularios:resultados.sin_datos')}
              />
            </div>
          </div>

          {/* Agregados + individuales por momento */}
          {([['inicial', detalle.inicial], ['final', detalle.final]] as const).map(([key, bloque]) => (
            <div key={key} className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
              <div className="section-card-header">
                <span className="section-card-title">{t(`formularios:resultados.${key}`)}</span>
                <span className="count-badge">{bloque.totalRespuestas}</span>
              </div>
              <div className="section-card-body">
                {bloque.dimensiones.length > 0 && <BarrasDimensiones dimensiones={bloque.dimensiones} />}
                {bloque.individuales.length > 0 && (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <h4 style={{ marginBottom: 'var(--space-2)' }}>
                      {t('formularios:resultados.individuales')}
                    </h4>
                    <DataTable
                      columns={individualColumns}
                      rows={bloque.individuales}
                      rowKey={ind => ind.usuario.id}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
