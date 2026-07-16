import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { PageHeader, Loading, ProgressBar } from '../../components/ui';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface DimensionAgregada {
  dimension: string;
  promedio: number;
  n: number;
}

interface Diagnostico {
  inicial: { totalRespuestas: number; dimensiones: DimensionAgregada[] };
  final: { totalRespuestas: number; dimensiones: DimensionAgregada[] };
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
  const { t } = useTranslation(['formularios', 'common']);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      .catch((err) => { if (!cancelled) setToast(translateError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programaId]);

  return (
    <div className="page page-narrow">
      <PageHeader
        back={{ to: '/facilitador/programas', label: t('formularios:resultados.back') }}
        title={t('formularios:resultados.title')}
      />
      {toast && <div className="toast">{toast}</div>}
      {loading && <Loading label={t('common:loading')} />}

      {diagnostico && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('formularios:resultados.diagnostico')}</h2>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {([['inicial', diagnostico.inicial], ['final', diagnostico.final]] as const).map(([key, bloque]) => (
              <div key={key}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
                  {t(`formularios:resultados.${key}`)} · {bloque.totalRespuestas} {t('formularios:resultados.n').toLowerCase()}
                </div>
                {bloque.dimensiones.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{t('formularios:resultados.sin_datos')}</p>
                ) : (
                  <BarrasDimensiones dimensiones={bloque.dimensiones} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>{t('formularios:resultados.feedback')}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{t('formularios:resultados.feedback_hint')}</p>
          {feedback.totalRespuestas === 0 && <p>{t('formularios:resultados.sin_datos')}</p>}
          {feedback.campos.map(campo => (
            <div key={campo.campoId} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>{campo.etiqueta}</div>
              {campo.promedio !== undefined && campo.promedio !== null && (
                <div style={{ fontSize: '0.85rem' }}>
                  {t('formularios:resultados.promedio')}: <strong>{campo.promedio.toFixed(2)}</strong> (n={campo.n})
                </div>
              )}
              {campo.opciones && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {campo.opciones.map(op => (
                    <div key={op.valor} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                      <span style={{ minWidth: 160 }}>{op.etiqueta}</span>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={campo.n ? (op.conteo / campo.n) * 100 : 0} color="#14B8A6" label={op.etiqueta} />
                      </div>
                      <span style={{ minWidth: 24, textAlign: 'right' }}>{op.conteo}</span>
                    </div>
                  ))}
                </div>
              )}
              {campo.textos && campo.textos.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem' }}>
                  {campo.textos.map((texto, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{texto}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BarrasDimensiones({ dimensiones }: { dimensiones: DimensionAgregada[] }) {
  const max = Math.max(...dimensiones.map(d => d.promedio), 5);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dimensiones.map(d => (
        <div key={d.dimension} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
          <span style={{ minWidth: 140, textTransform: 'capitalize' }}>{d.dimension}</span>
          <div style={{ flex: 1 }}>
            <ProgressBar value={(d.promedio / max) * 100} color="#38BDF8" label={d.dimension} />
          </div>
          <span style={{ minWidth: 44, textAlign: 'right', fontWeight: 600 }}>{d.promedio.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
