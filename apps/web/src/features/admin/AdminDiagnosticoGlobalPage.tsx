import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { BarrasDimensiones } from '../facilitador/ResultadosPage';
import { PageHeader, Breadcrumb, Button, Field, FilterToolbar, ProgressBar, DataTable, Loading, StatusBadge } from '../../components/ui';
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
// mismo promedio: son dos secciones separadas.
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

interface Detalle {
  totalRespuestas: number;
  dimensiones: DimensionesPorCategoria;
  porCampo: CampoAgregado[];
  individuales: Individual[];
}

interface Empresa { id: string; nombre: string }
interface Programa { id: string; nombre: string; empresaId: string }

// RF-28/RN-07: respuestas del diagnóstico de inicio GLOBAL (sin programa).
// Solo admin — agregado por dimensión, individuales con nombre/email y export.
// Filtro opcional por empresa/programa según la MATRÍCULA del estudiante.
export function AdminDiagnosticoGlobalPage() {
  const { t } = useTranslation(['formularios', 'common', 'admin']);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(false);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [programaId, setProgramaId] = useState('');

  const queryString = useCallback(
    (extra?: Record<string, string>) => {
      const p = new URLSearchParams({ ...extra });
      if (empresaId) p.set('empresaId', empresaId);
      if (programaId) p.set('programaId', programaId);
      const s = p.toString();
      return s ? `?${s}` : '';
    },
    [empresaId, programaId],
  );

  // Empresas (una vez) para el selector.
  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/organization/empresas`)
      .then(r => r.json())
      .then((data: Empresa[]) => setEmpresas(data))
      .catch(err => toast.error(translateError(err)));
  }, []);

  // Programas de la empresa elegida (cascada). Sin empresa → sin programas.
  useEffect(() => {
    if (!empresaId) {
      setProgramas([]);
      return;
    }
    fetchWithErrorMapping(`${API_URL}/admin/programas?empresaId=${empresaId}`)
      .then(r => r.json())
      .then((data: Programa[]) => setProgramas(data))
      .catch(err => toast.error(translateError(err)));
  }, [empresaId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const det = await fetchWithErrorMapping(
        `${API_URL}/admin/diagnostico-inicial-global${queryString()}`,
      ).then(r => r.json());
      setDetalle(det);
    } catch (err) {
      toast.error(translateError(err));
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  const exportar = async () => {
    try {
      const res = await fetchWithErrorMapping(
        `${API_URL}/admin/diagnostico-inicial-global${queryString({ export: 'xlsx' })}`,
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagnostico-inicial-global.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(translateError(err));
    }
  };

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
          { label: t('admin:sidebar.home'), to: '/admin/inicio' },
          { label: t('admin:sidebar.formularios'), to: '/admin/formularios' },
          { label: t('formularios:resultados.global_title') },
        ]}
      />
      <PageHeader
        title={t('formularios:resultados.global_title')}
        description={t('formularios:resultados.global_hint')}
        actions={<Button variant="primary" onClick={exportar}>{t('formularios:resultados.export')}</Button>}
      />
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge variant="neutral">{t('formularios:resultados.global_scope_badge')}</StatusBadge>
      </div>

      <FilterToolbar>
        <Field label={t('admin:usuarios.filters.empresa')}>
          <select
            className="input"
            value={empresaId}
            onChange={e => { setEmpresaId(e.target.value); setProgramaId(''); }}
          >
            <option value="">{t('formularios:resultados.filtro_todas_empresas')}</option>
            {empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label={t('admin:usuarios.filters.programa')}>
          <select
            className="input"
            value={programaId}
            onChange={e => setProgramaId(e.target.value)}
            disabled={!empresaId}
          >
            <option value="">{t('formularios:resultados.filtro_todos_programas')}</option>
            {programas.map(prog => (
              <option key={prog.id} value={prog.id}>{prog.nombre}</option>
            ))}
          </select>
        </Field>
      </FilterToolbar>

      {loading && <Loading label={t('common:loading')} />}

      {detalle && (
        <>
          <div className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="section-card-header">
              <span className="section-card-title">{t('formularios:resultados.title')}</span>
              <span className="count-badge">{detalle.totalRespuestas}</span>
            </div>
            <div className="section-card-body">
              {detalle.dimensiones.escala.length === 0 && detalle.dimensiones.seleccion.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {t(detalle.totalRespuestas === 0 ? 'formularios:resultados.sin_datos' : 'formularios:resultados.sin_dimensiones')}
                </p>
              ) : (
                <div className="categoria-grid">
                  {(['escala', 'seleccion'] as const).map(categoria => {
                    const dims = detalle.dimensiones[categoria];
                    if (dims.length === 0) return null;
                    const individuales = detalle.individuales.filter(ind => ind.scores?.[categoria] && Object.keys(ind.scores[categoria]).length > 0);
                    return (
                      <div key={categoria}>
                        <h4 style={{ marginBottom: 'var(--space-1)' }}>
                          {t(`formularios:resultados.categoria_${categoria}`)}
                        </h4>
                        <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-2)' }}>
                          {t(`formularios:resultados.categoria_${categoria}_desc`)}
                        </p>
                        <BarrasDimensiones dimensiones={dims} />
                        {individuales.length > 0 && (
                          <div style={{ marginTop: 'var(--space-4)' }}>
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>
                              {t('formularios:resultados.individuales')}
                            </h4>
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
              )}
            </div>
          </div>

          {/* Desglose por pregunta: solo opción única/múltiple (conteo por opción).
              Las preguntas de texto libre quedan fuera: pueden traer respuestas
              muy largas y no encajan en esta cuadrícula (RF-34). */}
          {(() => {
            const camposOpciones = detalle.porCampo.filter(esCampoOpciones);
            if (camposOpciones.length === 0) return null;
            return (
              <div className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="section-card-header">
                  <span className="section-card-title">{t('formularios:resultados.por_pregunta')}</span>
                </div>
                <div className="section-card-body">
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
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
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
