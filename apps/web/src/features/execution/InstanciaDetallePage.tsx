import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  pasos: StepResult[];
}

export function InstanciaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<InstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/admin/instancias/${id}`);

        if (res.status === 404) {
          setError('Instancia no encontrada');
          return;
        }

        if (!res.ok) throw new Error('Error al cargar los detalles de la instancia');

        setData(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  if (loading) return <div className="runner-center">Cargando detalles...</div>;
  if (error || !data) {
    return (
      <div className="runner-center" style={{ flexDirection: 'column', gap: '1rem' }}>
        <div style={{ color: '#ef4444' }}>{error || 'Error desconocido'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/instancias')}>Volver al listado</button>
      </div>
    );
  }

  const isFinalizado = data.estado === 'finalizado';

  return (
    <div className="layout-content">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            className="btn btn-secondary"
            style={{ marginBottom: '10px', padding: '5px 10px', fontSize: '0.8rem' }}
            onClick={() => navigate('/admin/instancias')}
          >
            ← Volver a Instancias
          </button>
          <h1>Detalle de Ejecución</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>ID: {data.id}</p>
        </div>
        <span className={`status-badge ${data.estado === 'finalizado' ? 'status-success' :
            data.estado === 'iniciado' ? 'status-warning' : 'status-neutral'
          }`} style={{ fontSize: '1rem', padding: '8px 16px' }}>
          {data.estado.toUpperCase()}
        </span>
      </div>

      {!isFinalizado && (
        <div className="card mb-6" style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412' }}>
          ⚠️ <strong>Aviso:</strong> Esta instancia aún no está finalizada. Los resultados pueden estar incompletos.
        </div>
      )}

      {/* Sección 1: Información General */}
      <div className="card mb-8" style={{ borderLeft: '4px solid var(--color-primary)' }}>
        <h3 className="mb-4">Información General de la Ejecución</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Actividad</label>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{data.actividad.nombre}</div>
          </div>
          {data.actividad.plantillaOrigen && (
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Plantilla de origen</label>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📋</span> {data.actividad.plantillaOrigen.nombre}
              </div>
            </div>
          )}
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Usuario / Responsable</label>
            <div style={{ fontWeight: 600 }}>{data.usuario?.nombre || 'Pendiente de identificación'}</div>
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
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Fecha de Inicio</label>
            <div>{data.fechaInicio ? new Date(data.fechaInicio).toLocaleString() : '-'}</div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Fecha de Fin</label>
            <div>{data.fechaFin ? new Date(data.fechaFin).toLocaleString() : '-'}</div>
          </div>
        </div>
      </div>

      {/* Sección 2: Resultados (Layout tipo Informe) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <h3 className="mb-2">Resultados Detallados por Paso</h3>
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
                      Objetivo: {p.objetivo}
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
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instrucciones Metodológicas:</strong>
                  <div style={{ color: '#581c87', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{p.instrucciones}</div>
                </div>
              )}

              {p.promptIa && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompt IA Configurado:</strong>
                  <div style={{ color: '#334155', fontStyle: 'normal' }}>{p.promptIa}</div>
                </div>
              )}

              {/* Per-pregunta answers (new model) */}
              {(p.preguntas ?? []).length > 0 ? (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {(p.preguntas ?? []).map((q, qIdx) => (
                    <div key={q.preguntaId} style={{ paddingBottom: qIdx < (p.preguntas?.length ?? 0) - 1 ? '1.25rem' : 0, borderBottom: qIdx < (p.preguntas?.length ?? 0) - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      {(p.preguntas?.length ?? 0) > 1 && (
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Pregunta {qIdx + 1}
                        </div>
                      )}
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: 10 }}>{q.enunciado}</div>
                      {q.archivoNombre && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: '0.82rem', color: '#1D4ED8', fontWeight: 600 }}>📎 {q.archivoNombre}</span>
                        </div>
                      )}
                      {q.respuesta ? (
                        <div style={{ padding: '1rem 1.25rem', backgroundColor: 'white', border: '1px solid var(--color-bg-page)', borderRadius: '8px', lineHeight: '1.6', fontSize: '0.95rem', color: '#1e293b', overflowX: 'auto' }}>
                          <div className="markdown-anterior">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.respuesta}</ReactMarkdown>
                          </div>
                          {q.fechaRespuesta && (
                            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#94a3b8', textAlign: 'right' }}>
                              Respondido el: {new Date(q.fechaRespuesta).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#fcfcfc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.875rem' }}>
                          Sin responder todavía
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Legacy: pasos sin preguntas */
                <>
                  {p.archivoNombre && (
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 8 }}>
                      <span style={{ fontSize: '0.82rem', color: '#1D4ED8', fontWeight: 600 }}>📎 {p.archivoNombre}</span>
                      <a href={`${API_URL}/admin/instancias/${data.id}/excel/${p.pasoId}`} download={p.archivoNombre}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', fontSize: '0.78rem', background: '#2563EB', color: 'white', borderRadius: 6, fontWeight: 600, textDecoration: 'none' }}>
                        ⬇ Descargar
                      </a>
                    </div>
                  )}
                  <div style={{ marginTop: '1rem' }}>
                    {p.respuesta ? (
                      <div style={{ padding: '1.5rem', backgroundColor: 'white', border: '1px solid var(--color-bg-page)', borderRadius: '8px', lineHeight: '1.6', fontSize: '1.05rem', color: '#1e293b', overflowX: 'auto' }}>
                        <div className="markdown-anterior">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.respuesta}</ReactMarkdown>
                        </div>
                        {p.fechaRespuesta && (
                          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'right' }}>
                            Respondido el: {new Date(p.fechaRespuesta).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fcfcfc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Sin responder todavía
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
