import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:3000';

interface StepResult {
  pasoId: string;
  orden: number;
  titulo: string;
  objetivo?: string;
  instrucciones?: string;
  promptIa?: string | null;
  respuesta: string | null;
  fechaRespuesta: string | null;
}

interface InstanceDetail {
  id: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  actividad: { id: string; nombre: string };
  usuario?: { id: string; nombre: string };
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
        <span className={`status-badge ${
          data.estado === 'finalizado' ? 'status-success' : 
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
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Usuario / Responsable</label>
            <div style={{ fontWeight: 600 }}>{data.usuario?.nombre || 'Pendiente de identificación'}</div>
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

              <div style={{ marginTop: '1rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>RESPUESTA DEL USUARIO:</strong>
                {p.respuesta ? (
                  <div style={{ 
                    padding: '1.5rem', 
                    backgroundColor: 'white', 
                    border: '1px solid var(--color-bg-page)', 
                    borderRadius: '8px',
                    whiteSpace: 'pre-wrap', 
                    lineHeight: '1.6',
                    fontSize: '1.05rem',
                    color: '#1e293b',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    {p.respuesta}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'right' }}>
                      Respondido el: {new Date(p.fechaRespuesta!).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fcfcfc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8', fontStyle: 'italic' }}>
                    Sin responder todavía
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
