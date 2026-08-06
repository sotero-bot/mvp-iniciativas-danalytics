import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { BarrasDimensiones } from '../facilitador/ResultadosPage';
import { PageHeader, Breadcrumb, Button, StatusBadge, DataTable, Loading, Alert, InfoTooltip, ProgressBar } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { formatDimension } from '../../shared/formatDimension';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type Categoria = 'escala' | 'seleccion';

interface ScoreDimension {
  total: number;
  promedio: number;
  respondidas: number;
}

interface DimensionAgregada {
  dimension: string;
  promedio: number;
  n: number;
  preguntas: number;
}

// Escala (likert/número) y selección (opción múltiple) nunca se mezclan en un
// mismo promedio: son dos secciones separadas en toda la vista.
interface DimensionesPorCategoria {
  escala: DimensionAgregada[];
  seleccion: DimensionAgregada[];
}

interface Individual {
  usuario: { id: string; nombre: string; email: string };
  scores: Record<Categoria, Record<string, ScoreDimension>> | null;
  enviadoEn: string | null;
}

type CampoOpciones = { campoId: string; etiqueta: string; tipoCampo: string; opciones: { valor: string; etiqueta: string; conteo: number }[]; n: number };

type CampoAgregado =
  | { campoId: string; etiqueta: string; tipoCampo: string; promedio: number | null; n: number }
  | CampoOpciones
  | { campoId: string; etiqueta: string; tipoCampo: string; textos: string[]; n: number };

// "Por pregunta" solo muestra preguntas de opción única/múltiple: las de texto
// libre pueden traer respuestas muy largas y no encajan en esta cuadrícula.
const esCampoOpciones = (c: CampoAgregado): c is CampoOpciones => 'opciones' in c;

interface Bloque {
  totalRespuestas: number;
  dimensiones: DimensionesPorCategoria;
  porCampo: CampoAgregado[];
  individuales: Individual[];
}

interface ComparativoDimension {
  dimension: string;
  inicial: number | null;
  final: number | null;
  preguntas: number;
}

interface Detalle {
  inicial: Bloque;
  final: Bloque;
  comparativo: Record<Categoria, ComparativoDimension[]>;
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

  // El diagnóstico final está en el modelo/requerimientos pero, si el programa
  // nunca tomó snapshot de ese tipo, es porque no se ha creado ninguna
  // plantilla — no es "sin respuestas todavía", es una funcionalidad pendiente.
  const finalPendiente = !loading && !snapshots.some(s => s.tipoFormulario === 'diagnostico_final');

  const dimensionHeader = (dimension: string, preguntas: number) => (
    <>
      {formatDimension(dimension)}
      {preguntas > 1 && (
        <div style={{ fontSize: '0.7rem', fontWeight: 400, textTransform: 'none', color: 'var(--color-text-tertiary)' }}>
          {t('formularios:resultados.n_preguntas', { count: preguntas })}
        </div>
      )}
    </>
  );

  const comparativoColumns: DataTableColumn<ComparativoDimension>[] = [
    { key: 'dimension', header: t('formularios:resultados.dimension'), width: '260px', render: fila => dimensionHeader(fila.dimension, fila.preguntas) },
    { key: 'inicial', header: t('formularios:resultados.inicial'), width: '140px', render: fila => fila.inicial?.toFixed(2) ?? '—' },
    { key: 'final', header: t('formularios:resultados.final'), width: '140px', render: fila => <strong>{fila.final?.toFixed(2) ?? '—'}</strong> },
  ];

  const individualColumnsFor = (categoria: Categoria, dims: DimensionAgregada[]): DataTableColumn<Individual>[] => [
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
    ...dims.map(d => ({
      key: d.dimension,
      header: dimensionHeader(d.dimension, d.preguntas),
      render: (ind: Individual) => ind.scores?.[categoria]?.[d.dimension]?.promedio?.toFixed(2) ?? '—',
    })),
  ];

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.programas'), to: '/admin/programas' },
          { label: programaNombre || '—' },
          { label: t('formularios:resultados.diagnostico_programa_title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('formularios:resultados.diagnostico_programa_title')}
        description={t('formularios:resultados.diagnostico_programa_desc')}
        actions={<Button variant="primary" onClick={exportar}>{t('formularios:resultados.export')}</Button>}
      />
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge variant="info">{t('formularios:resultados.diagnostico_programa_scope_badge')}</StatusBadge>
      </div>
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
          {/* Comparativo (RF-34). Escala y selección van en secciones separadas:
              no son la misma escala de medición y nunca se combinan. */}
          <div className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="section-card-header">
              <span className="section-card-title">
                {t('formularios:resultados.comparativo')}
                <InfoTooltip label={t('formularios:resultados.comparativo_info')} />
              </span>
            </div>
            <div className="section-card-body">
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 0 }}>
                {t('formularios:resultados.comparativo_hint')}
              </p>
              {finalPendiente && (
                <Alert variant="info" title={t('formularios:resultados.final_pendiente_titulo')} className="mb-4">
                  {t('formularios:resultados.final_pendiente_desc')}
                </Alert>
              )}
              <div className="categoria-grid" style={{ marginTop: 'var(--space-4)' }}>
              {(['escala', 'seleccion'] as const).map(categoria => (
                <div key={categoria}>
                  <h4 style={{ marginBottom: 'var(--space-1)' }}>
                    {t(`formularios:resultados.categoria_${categoria}`)}
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-2)' }}>
                    {t(`formularios:resultados.categoria_${categoria}_desc`)}
                  </p>
                  <DataTable
                    columns={comparativoColumns}
                    rows={detalle.comparativo[categoria]}
                    rowKey={fila => fila.dimension}
                    emptyMessage={t(
                      detalle.inicial.totalRespuestas > 0 || detalle.final.totalRespuestas > 0
                        ? 'formularios:resultados.sin_dimensiones'
                        : 'formularios:resultados.sin_datos',
                    )}
                  />
                </div>
              ))}
              </div>
            </div>
          </div>

          {/* Agregados + individuales por momento, cada uno separado en dos
              secciones (escala / selección). */}
          {([['inicial', detalle.inicial], ['final', detalle.final]] as const).map(([key, bloque]) => (
            <div key={key} className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
              <div className="section-card-header">
                <span className="section-card-title">
                  {t(`formularios:resultados.${key}`)}
                  <InfoTooltip label={t('formularios:resultados.comparativo_info')} />
                </span>
                <span className="count-badge">{bloque.totalRespuestas}</span>
              </div>
              <div className="section-card-body">
                {key === 'final' && finalPendiente && (
                  <Alert variant="info" title={t('formularios:resultados.final_pendiente_titulo')}>
                    {t('formularios:resultados.final_pendiente_desc')}
                  </Alert>
                )}
                <div className="categoria-grid" style={{ marginTop: 'var(--space-4)' }}>
                  {(['escala', 'seleccion'] as const).map(categoria => {
                    const dims = bloque.dimensiones[categoria];
                    if (dims.length === 0) {
                      if (bloque.totalRespuestas === 0) return null;
                      return (
                        <div key={categoria}>
                          <h4 style={{ marginBottom: 'var(--space-1)' }}>
                            {t(`formularios:resultados.categoria_${categoria}`)}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 0 }}>
                            {t('formularios:resultados.sin_dimensiones')}
                          </p>
                        </div>
                      );
                    }
                    const individuales = bloque.individuales.filter(ind => ind.scores?.[categoria] && Object.keys(ind.scores[categoria]).length > 0);
                    return (
                      <div key={categoria}>
                        <h4 style={{ marginBottom: 'var(--space-1)' }}>
                          {t(`formularios:resultados.categoria_${categoria}`)}
                        </h4>
                        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 0 }}>
                          {t(`formularios:resultados.categoria_${categoria}_desc`)}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 0 }}>
                          {t('formularios:resultados.bloque_barras_hint')}
                        </p>
                        <BarrasDimensiones dimensiones={dims} />
                        {individuales.length > 0 && (
                          <div style={{ marginTop: 'var(--space-4)' }}>
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>
                              {t('formularios:resultados.individuales')}
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 0 }}>
                              {t('formularios:resultados.bloque_individuales_hint')}
                            </p>
                            <DataTable
                              columns={individualColumnsFor(categoria, dims)}
                              rows={individuales}
                              rowKey={ind => ind.usuario.id}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const camposOpciones = bloque.porCampo.filter(esCampoOpciones);
                  if (camposOpciones.length === 0) return null;
                  return (
                    <div style={{ marginTop: 'var(--space-5)' }}>
                      <h4 style={{ marginBottom: 'var(--space-1)' }}>
                        {t('formularios:resultados.por_pregunta')}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-2)' }}>
                        {t('formularios:resultados.por_pregunta_hint')}
                      </p>
                      <div className="campo-grid">
                        {camposOpciones.map(campo => (
                          <div key={campo.campoId} style={{ border: '1px solid var(--color-border)', padding: 'var(--space-3)', minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{campo.etiqueta}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }}>
                              {t(`formularios:tipos_campo.${campo.tipoCampo}`)} · {t('formularios:builder.respuestas', { count: campo.n })}
                            </div>
                            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                              {campo.opciones.map(op => {
                                const pct = campo.n > 0 ? Math.round((op.conteo / campo.n) * 100) : 0;
                                return (
                                  <div key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.78rem' }}>
                                    <span
                                      title={op.etiqueta}
                                      style={{ minWidth: 0, flexBasis: '38%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    >
                                      {op.etiqueta}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <ProgressBar value={pct} label={op.etiqueta} />
                                    </div>
                                    <span style={{ minWidth: 52, textAlign: 'right', flexShrink: 0 }}>{op.conteo} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
