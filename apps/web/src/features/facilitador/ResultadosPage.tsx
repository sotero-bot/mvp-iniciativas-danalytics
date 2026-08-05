import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Breadcrumb, Loading, ProgressBar } from '../../components/ui';
import { toast } from '../../components/toast-store';
import { formatDimension } from '../../shared/formatDimension';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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

interface Diagnostico {
  inicial: { totalRespuestas: number; dimensiones: DimensionesPorCategoria };
  final: { totalRespuestas: number; dimensiones: DimensionesPorCategoria };
}

interface CampoFeedback {
  campoId: string;
  etiqueta: string;
  tipoCampo: string;
  promedio?: number | null;
  opciones?: { valor: string; etiqueta: string; conteo: number }[];
  textos?: string[];
  n: number;
}

interface Feedback {
  totalRespuestas: number;
  campos: CampoFeedback[];
}

// RF-33/RF-36: el facilitador ve SOLO agregados (sin individuales) y el
// feedback es anónimo — el backend nunca envía identificadores.
export function FacilitadorResultadosPage() {
  const { id: programaId = '' } = useParams();
  const { t } = useTranslation(['formularios', 'facilitador', 'common', 'admin']);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  // Nombre del programa para el breadcrumb/eyebrow (dónde está el usuario).
  const [programaNombre, setProgramaNombre] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/diagnostico/agregado`).then(r => r.json()),
      fetchWithErrorMapping(`${API_URL}/facilitador/programas/${programaId}/feedback/agregado`).then(r => r.json()),
    ])
      .then(([diag, fb]) => {
        if (cancelled) return;
        setDiagnostico(diag);
        setFeedback(fb);
      })
      .catch((err) => { if (!cancelled) toast.error(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId]);

  useEffect(() => {
    fetchWithErrorMapping(`${API_URL}/programas`)
      .then((res) => res.json())
      .then((data: { id: string; nombre: string }[]) => {
        const p = data.find((x) => x.id === programaId);
        if (p) setProgramaNombre(p.nombre);
      })
      .catch(() => {});
  }, [programaId]);

  return (
    <>
      <Breadcrumb
        items={[
          { label: t('admin:sidebar.home'), to: '/inicio' },
          { label: t('facilitador:programas.title'), to: '/facilitador/programas' },
          { label: programaNombre || '—' },
          { label: t('formularios:resultados.title') },
        ]}
      />
      <PageHeader
        eyebrow={programaNombre || undefined}
        title={t('formularios:resultados.title')}
      />
      {loading && <Loading label={t('common:loading')} />}

      {diagnostico && (
        <div className="section-card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="section-card-header">
            <span className="section-card-title">{t('formularios:resultados.diagnostico')}</span>
          </div>
          <div className="section-card-body">
            <div style={{ display: 'grid', gap: 'var(--space-5)', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {([['inicial', diagnostico.inicial], ['final', diagnostico.final]] as const).map(([key, bloque]) => (
                <div key={key}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 'var(--space-2)' }}>
                    {t(`formularios:resultados.${key}`)} · {bloque.totalRespuestas} {t('formularios:resultados.n').toLowerCase()}
                  </div>
                  {bloque.dimensiones.escala.length === 0 && bloque.dimensiones.seleccion.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{t('formularios:resultados.sin_datos')}</p>
                  ) : (
                    (['escala', 'seleccion'] as const).map(categoria => {
                      const dims = bloque.dimensiones[categoria];
                      if (dims.length === 0) return null;
                      return (
                        <div key={categoria} style={{ marginBottom: 'var(--space-3)' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {t(`formularios:resultados.categoria_${categoria}`)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>
                            {t(`formularios:resultados.categoria_${categoria}_desc`)}
                          </div>
                          <BarrasDimensiones dimensiones={dims} />
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">{t('formularios:resultados.feedback')}</span>
            <span className="count-badge">{feedback.totalRespuestas}</span>
          </div>
          <div className="section-card-body">
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 0 }}>
              {t('formularios:resultados.feedback_hint')}
            </p>
            {feedback.totalRespuestas === 0 && <p>{t('formularios:resultados.sin_datos')}</p>}
            {feedback.campos.map(campo => (
              <div key={campo.campoId} style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 'var(--space-2)' }}>{campo.etiqueta}</div>
                {campo.promedio !== undefined && campo.promedio !== null && (
                  <div style={{ fontSize: '0.85rem' }}>
                    {t('formularios:resultados.promedio')}: <strong>{campo.promedio.toFixed(2)}</strong> (n={campo.n})
                  </div>
                )}
                {campo.opciones && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {campo.opciones.map(op => (
                      <div key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.82rem' }}>
                        <span style={{ minWidth: 160 }}>{op.etiqueta}</span>
                        <div style={{ flex: 1 }}>
                          <ProgressBar value={campo.n ? (op.conteo / campo.n) * 100 : 0} color="var(--color-accent)" label={op.etiqueta} />
                        </div>
                        <span style={{ minWidth: 24, textAlign: 'right' }}>{op.conteo}</span>
                      </div>
                    ))}
                  </div>
                )}
                {campo.textos && campo.textos.length > 0 && (
                  <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                    {campo.textos.map((texto, i) => (
                      <li key={i} style={{ marginBottom: 'var(--space-1)' }}>{texto}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function BarrasDimensiones({ dimensiones }: { dimensiones: DimensionAgregada[] }) {
  const { t } = useTranslation('formularios');
  const max = Math.max(...dimensiones.map(d => d.promedio), 5);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {dimensiones.map(d => (
        <div key={d.dimension} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.82rem' }}>
          <span style={{ minWidth: 140 }}>
            {formatDimension(d.dimension)}
            {d.preguntas > 1 && (
              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-text-tertiary)' }}>
                {t('resultados.n_preguntas', { count: d.preguntas })}
              </span>
            )}
          </span>
          <div style={{ flex: 1 }}>
            <ProgressBar value={(d.promedio / max) * 100} color="var(--color-primary)" label={formatDimension(d.dimension)} />
          </div>
          <span style={{ minWidth: 44, textAlign: 'right', fontWeight: 600 }}>{d.promedio.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
