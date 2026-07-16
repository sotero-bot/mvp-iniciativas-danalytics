import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CanvasGrid } from './CanvasGrid';
import { PageHeader, StatusBadge, Loading, Alert } from '../../components/ui';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface PreguntaResult {
  preguntaId: string;
  orden: number;
  enunciado: string;
  respuesta?: string | null;
  respuestaUsuario?: string | null;
  respuestaIa?: string | null;
  archivoNombre?: string | null;
  contenidoArchivo?: string | null;
  fechaRespuesta?: string | null;
}

interface StepResult {
  pasoId: string;
  orden: number;
  titulo: string;
  objetivo?: string;
  instrucciones?: string;
  promptIa?: string | null;
  respuesta: string | null;
  fechaRespuesta: string | null;
  archivoNombre?: string | null;
  contenidoArchivo?: string | null;
  preguntas?: PreguntaResult[];
}

interface InstanceDetail {
  id: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  actividad: { id: string; nombre: string; plantillaOrigen?: { id: string; nombre: string } | null };
  usuario?: { id: string; nombre: string; email?: string; cargo?: string; area?: string };
  canvasBloques?: Array<{ pasoId: string; resumen: string }>;
  pasos: StepResult[];
}

export function InstanciaDetallePage() {
  const { t } = useTranslation(['execution', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetchWithErrorMapping(`${API_URL}/admin/instancias/${id}`);
        setData(await res.json());
      } catch (err) {
        setError(translateError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  if (loading) return <div className="runner-center"><Loading label={t('execution:instancia_detalle.loading')} /></div>;
  if (error || !data) {
    return (
      <div className="runner-center" style={{ flexDirection: 'column', gap: '1rem' }}>
        <Alert variant="danger">{error || t('execution:instancia_detalle.errors.unknown')}</Alert>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/instancias')}>{t('execution:instancia_detalle.back_to_list_button')}</button>
      </div>
    );
  }

  const isFinalizado = data.estado === 'finalizado';

  return (
    <div className="layout-content">
      <PageHeader
        back={{ to: '/admin/instancias', label: t('execution:instancia_detalle.back_to_list') }}
        title={t('execution:instancia_detalle.page_title')}
        description={<>{t('execution:instancia_detalle.id_label')} {data.id}</>}
        actions={
          <StatusBadge variant={data.estado === 'finalizado' ? 'success' :
            data.estado === 'iniciado' ? 'warning' : 'neutral'}>
            {data.estado.toUpperCase()}
          </StatusBadge>
        }
      />

      {!isFinalizado && (
        <Alert variant="warning" className="mb-6">
          {t('execution:instancia_detalle.warning_not_finished')}
        </Alert>
      )}

      {/* Sección 1: Información General */}
      <div className="card mb-8" style={{ borderLeft: '4px solid var(--color-primary)' }}>
        <h3 className="mb-4">{t('execution:instancia_detalle.general_info')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{t('execution:instancia_detalle.fields.actividad')}</label>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{data.actividad.nombre}</div>
          </div>
          {data.actividad.plantillaOrigen && (
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{t('execution:instancia_detalle.fields.plantilla_origen')}</label>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📋</span> {data.actividad.plantillaOrigen.nombre}
              </div>
            </div>
          )}
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{t('execution:instancia_detalle.fields.usuario')}</label>
            <div style={{ fontWeight: 600 }}>{data.usuario?.nombre || t('execution:instancia_detalle.user_pending')}</div>
            {data.usuario?.area && (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {data.usuario.area}{data.usuario.cargo ? ` · ${data.usuario.cargo}` : ''}
              </div>
            )}
            {data.usuario?.email && (
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', marginTop: 1 }}>{data.usuario.email}</div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{t('execution:instancia_detalle.fields.fecha_inicio')}</label>
            <div>{data.fechaInicio ? new Date(data.fechaInicio).toLocaleString() : '-'}</div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{t('execution:instancia_detalle.fields.fecha_fin')}</label>
            <div>{data.fechaFin ? new Date(data.fechaFin).toLocaleString() : '-'}</div>
          </div>
        </div>
      </div>

      {/* Sección 2: Analytics Canvas (solo si hay bloques generados) */}
      {data.canvasBloques && data.canvasBloques.length > 0 && (
        <div className="card mb-8">
          <CanvasGrid
            bloques={Object.fromEntries(data.canvasBloques.map((b) => [b.pasoId, b.resumen]))}
            pasos={data.pasos.map((p) => ({ id: p.pasoId, titulo: p.titulo, orden: p.orden }))}
          />
        </div>
      )}

      {/* Sección 3: Resultados (Layout tipo Informe) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <h3 className="mb-2">{t('execution:instancia_detalle.responses_by_step')}</h3>
        {data.pasos.map((p) => (
          <div key={p.pasoId} className="card" style={{ padding: '0', overflow: 'hidden' }}>
            {/* Header del Paso */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-bg-page)', backgroundColor: 'var(--color-bg-subtle)' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {p.orden}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{p.titulo}</h4>
                  {p.objetivo && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>
                      {t('execution:instancia_detalle.step_objective')} {p.objetivo}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Contenido del Paso */}
            <div style={{ padding: '1.5rem' }}>
              {p.instrucciones && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#fdfcfe',
                  border: '1px solid #e9d5ff',
                  borderLeft: '4px solid #a855f7',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('execution:instancia_detalle.instructions_label')}</strong>
                  <div style={{ color: '#581c87', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{p.instrucciones}</div>
                </div>
              )}

              {p.promptIa && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-page)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('execution:instancia_detalle.prompt_ia_label')}</strong>
                  <div style={{ color: '#334155', fontStyle: 'normal' }}>{p.promptIa}</div>
                </div>
              )}

              {/* Per-pregunta answers (new model) */}
              {(p.preguntas ?? []).length > 0 ? (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {(p.preguntas ?? []).map((q, qIdx) => (
                    <div key={q.preguntaId} style={{ paddingBottom: qIdx < (p.preguntas?.length ?? 0) - 1 ? '1.25rem' : 0, borderBottom: qIdx < (p.preguntas?.length ?? 0) - 1 ? '1px solid var(--color-bg-subtle)' : 'none' }}>
                      {(p.preguntas?.length ?? 0) > 1 && (
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('execution:instancia_detalle.pregunta_label', { num: qIdx + 1 })}
                        </div>
                      )}
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: 10 }}>{q.enunciado}</div>
                      {q.archivoNombre && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-primary-light)', border: '1px solid #93C5FD', borderRadius: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--color-primary-hover)', fontWeight: 600 }}>📎 {q.archivoNombre}</span>
                        </div>
                      )}
                      {q.respuesta ? (
                        <div style={{ padding: '1rem 1.25rem', backgroundColor: 'white', border: '1px solid var(--color-bg-page)', borderRadius: '8px', lineHeight: '1.6', fontSize: '0.95rem', color: 'var(--color-text-main)', overflowX: 'auto' }}>
                          <div className="markdown-anterior">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.respuesta}</ReactMarkdown>
                          </div>
                          {q.fechaRespuesta && (
                            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-bg-subtle)', fontSize: '0.78rem', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                              {t('execution:instancia_detalle.answered_on', { date: new Date(q.fechaRespuesta).toLocaleString() })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#fcfcfc', border: '1px dashed var(--color-border-strong)', borderRadius: '8px', color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontSize: '0.875rem' }}>
                          {t('execution:instancia_detalle.no_response_yet')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Legacy: pasos sin preguntas */
                <>
                  {p.archivoNombre && (
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--color-primary-light)', border: '1px solid #93C5FD', borderRadius: 8 }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-primary-hover)', fontWeight: 600 }}>📎 {p.archivoNombre}</span>
                      <a href={`${API_URL}/admin/instancias/${data.id}/excel/${p.pasoId}`} download={p.archivoNombre}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', fontSize: '0.78rem', background: 'var(--color-primary)', color: 'white', borderRadius: 6, fontWeight: 600, textDecoration: 'none' }}>
                        {t('execution:instancia_detalle.download_legacy')}
                      </a>
                    </div>
                  )}
                  <div style={{ marginTop: '1rem' }}>
                    {p.respuesta ? (
                      <div style={{ padding: '1.5rem', backgroundColor: 'white', border: '1px solid var(--color-bg-page)', borderRadius: '8px', lineHeight: '1.6', fontSize: '1.05rem', color: 'var(--color-text-main)', overflowX: 'auto' }}>
                        <div className="markdown-anterior">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.respuesta}</ReactMarkdown>
                        </div>
                        {p.fechaRespuesta && (
                          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-bg-subtle)', fontSize: '0.8rem', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                            {t('execution:instancia_detalle.answered_on', { date: new Date(p.fechaRespuesta).toLocaleString() })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fcfcfc', border: '1px dashed var(--color-border-strong)', borderRadius: '8px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                        {t('execution:instancia_detalle.no_response_yet')}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
