import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { BarrasDimensiones } from '../facilitador/ResultadosPage';
import { PageHeader, Loading } from '../../components/ui';
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

type CampoAgregado =
  | { campoId: string; etiqueta: string; tipoCampo: string; promedio: number | null; n: number }
  | { campoId: string; etiqueta: string; tipoCampo: string; opciones: { valor: string; etiqueta: string; conteo: number }[]; n: number }
  | { campoId: string; etiqueta: string; tipoCampo: string; textos: string[]; n: number };

interface Detalle {
  totalRespuestas: number;
  dimensiones: { dimension: string; promedio: number; n: number }[];
  porCampo: CampoAgregado[];
  individuales: Individual[];
}

interface Empresa { id: string; nombre: string }
interface Programa { id: string; nombre: string; empresaId: string }

// RF-28/RN-07: respuestas del diagnóstico de inicio GLOBAL (sin programa).
// Solo admin — agregado por dimensión, individuales con nombre/email y export.
// Filtro opcional por empresa/programa según la MATRÍCULA del estudiante.
export function AdminDiagnosticoGlobalPage() {
  const { t } = useTranslation(['formularios', 'common']);
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

  const dimensiones = detalle ? detalle.dimensiones.map(d => d.dimension) : [];

  return (
    <div style={{ padding: '2rem', maxWidth: 960 }}>
      <PageHeader
        back={{ to: '/admin/formularios', label: t('formularios:resultados.back') }}
        title={t('formularios:resultados.global_title')}
        actions={<button className="btn" onClick={exportar}>⬇ {t('formularios:resultados.export')}</button>}
      />
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: -8 }}>
        {t('formularios:resultados.global_hint')}
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '0 0 1.25rem' }}>
        <select
          value={empresaId}
          onChange={e => { setEmpresaId(e.target.value); setProgramaId(''); }}
          style={{ padding: '6px 10px', minWidth: 200 }}
        >
          <option value="">{t('formularios:resultados.filtro_todas_empresas')}</option>
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
          ))}
        </select>
        <select
          value={programaId}
          onChange={e => setProgramaId(e.target.value)}
          disabled={!empresaId}
          style={{ padding: '6px 10px', minWidth: 200 }}
        >
          <option value="">{t('formularios:resultados.filtro_todos_programas')}</option>
          {programas.map(prog => (
            <option key={prog.id} value={prog.id}>{prog.nombre}</option>
          ))}
        </select>
      </div>

      {loading && <Loading label={t('common:loading')} />}

      {detalle && (
        <>
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>
            {detalle.totalRespuestas} {t('formularios:resultados.n').toLowerCase()}
          </h2>
          {detalle.dimensiones.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {t('formularios:resultados.sin_datos')}
            </p>
          ) : (
            <BarrasDimensiones dimensiones={detalle.dimensiones} />
          )}

          {detalle.individuales.length > 0 && (
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
                    {detalle.individuales.map(ind => (
                      <tr key={ind.usuario.id}>
                        <td>
                          {ind.usuario.nombre}
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{ind.usuario.email}</div>
                        </td>
                        <td>{ind.enviadoEn ? new Date(ind.enviadoEn).toLocaleDateString() : '—'}</td>
                        {dimensiones.map(d => (
                          <td key={d}>{ind.scores?.[d]?.promedio?.toFixed(2) ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Desglose por pregunta: conteo por opción, promedios y textos (RF-34) */}
        {detalle.porCampo.length > 0 && (
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('formularios:resultados.por_pregunta')}</h2>
            {detalle.porCampo.map(campo => (
              <div key={campo.campoId} style={{ padding: '10px 0', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{campo.etiqueta}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                  {t(`formularios:tipos_campo.${campo.tipoCampo}`)} · {t('formularios:builder.respuestas', { count: campo.n })}
                </div>
                {'opciones' in campo && (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {campo.opciones.map(op => {
                      const pct = campo.n > 0 ? Math.round((op.conteo / campo.n) * 100) : 0;
                      return (
                        <div key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                          <span style={{ minWidth: 200 }}>{op.etiqueta}</span>
                          <div style={{ flex: 1, background: 'var(--color-border)', borderRadius: 4, height: 10 }}>
                            <div style={{ width: `${pct}%`, background: '#14B8A6', height: '100%', borderRadius: 4 }} />
                          </div>
                          <span style={{ minWidth: 60, textAlign: 'right' }}>{op.conteo} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {'promedio' in campo && (
                  <div style={{ fontSize: '0.9rem' }}>
                    {t('formularios:resultados.promedio')}: <strong>{campo.promedio?.toFixed(2) ?? '—'}</strong>
                  </div>
                )}
                {'textos' in campo && (
                  campo.textos.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>—</div>
                  ) : (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: '0.82rem' }}>
                      {campo.textos.map((txt, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>{txt}</li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            ))}
          </div>
        )}
        </>
      )}
    </div>
  );
}
