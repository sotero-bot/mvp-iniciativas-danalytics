import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Paso {
  id: string;
  titulo: string;
  objetivo?: string;
  instrucciones?: string;
  usarIa?: boolean;
  promptIa?: string;
}

interface RunnerData {
  estado: string;
  nombreActividad: string;
  descripcionActividad?: string;
  usuarioId?: string;
  pasos: Paso[];
  interacciones: { pasoId: string; contenido: string }[];
}

export function RunnerPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RunnerData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [respuesta, setRespuesta] = useState('');
  const [respuestaIa, setRespuestaIa] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [enviandoIa, setEnviandoIa] = useState(false);
  const [iaViewMode, setIaViewMode] = useState<'preview' | 'edit'>('preview');
  const [userViewMode, setUserViewMode] = useState<'preview' | 'edit'>('edit');
  const [idenForm, setIdenForm] = useState({ nombre: '', email: '', cargo: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/execution/${token}`);
      if (!res.ok) throw new Error('No se pudo cargar la actividad');
      const json = await res.json();
      setData(json);

      // Encontrar por qué paso vamos (el primero sin respuesta)
      if (json.estado !== 'generado') {
        const lastAnsweredIndex = json.pasos.findIndex((p: Paso) =>
          !json.interacciones.some((i: any) => i.pasoId === p.id)
        );
        if (lastAnsweredIndex !== -1) {
          setCurrentStepIndex(lastAnsweredIndex);
          if (json.pasos[lastAnsweredIndex].promptIa) {
            setCustomPrompt(json.pasos[lastAnsweredIndex].promptIa);
          }
        } else if (json.estado === 'finalizado') {
          setCurrentStepIndex(json.pasos.length);
        }
      } else if (json.pasos.length > 0 && json.pasos[0].promptIa) {
        setCustomPrompt(json.pasos[0].promptIa);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleIniciar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/execution/${token}/iniciar`, { method: 'POST' });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Error al iniciar la actividad');
      }

      await loadData();
    } catch (err: any) {
      alert('Error al comenzar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIdentificar = async () => {
    if (!idenForm.nombre.trim()) return alert('El nombre es obligatorio');
    if (!idenForm.email.trim()) return alert('El correo electrónico es obligatorio');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/execution/${token}/identificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idenForm)
      });
      if (!res.ok) throw new Error('Error al registrar identificación');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSiguiente = async () => {
    const paso = data!.pasos[currentStepIndex];

    // Si el paso usa IA, la respuesta real es la de la IA. Si no usa IA, es la del usuario.
    const respuestaFinal = paso.usarIa ? respuestaIa : respuesta;

    if (!respuestaFinal.trim()) {
      if (paso.usarIa && !respuestaIa.trim()) {
        return alert('Debes consultar a la IA antes de continuar.');
      }
      return;
    }

    setLoading(true);

    await fetch(`${API_URL}/execution/${token}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pasoId: paso.id, contenido: respuestaFinal })
    });

    if (currentStepIndex < data!.pasos.length - 1) {
      const nuevaInteraccion = {
        pasoId: paso.id,
        contenido: respuestaFinal,
        fecha: new Date().toISOString()
      };

      setData(prev => prev ? {
        ...prev,
        interacciones: [...prev.interacciones.filter(i => i.pasoId !== paso.id), nuevaInteraccion]
      } : prev);

      setCurrentStepIndex(currentStepIndex + 1);
      setRespuesta('');
      setRespuestaIa('');
      if (data!.pasos[currentStepIndex + 1]?.promptIa) {
        setCustomPrompt(data!.pasos[currentStepIndex + 1].promptIa!);
      } else {
        setCustomPrompt('');
      }
    } else {
      await fetch(`${API_URL}/execution/${token}/finalizar`, { method: 'POST' });
      await loadData();
    }
    setLoading(false);
  };

  // Llamará a la API de ChatGPT
  const handleEnviarIA = async () => {
    if (!respuesta.trim()) return alert('Escribe tu respuesta antes de consultarla con IA');
    setEnviandoIa(true);
    setRespuestaIa('');

    const paso = data!.pasos[currentStepIndex];

    try {
      const res = await fetch(`${API_URL}/execution/${token}/ia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pasoId: paso.id, respuesta, customPrompt })
      });

      if (!res.ok) {
        throw new Error('Error al consultar la IA');
      }

      const json = await res.json();
      setRespuestaIa(json.respuestaIa);
    } catch (err: any) {
      alert('Error en Asistente IA: ' + err.message);
    } finally {
      setEnviandoIa(false);
    }
  };

  const getRespuestaPasoAnterior = (): string => {
    if (!data || currentStepIndex === 0) return '';
    const pasoAnterior = data.pasos[currentStepIndex - 1];
    const interaccion = data.interacciones.find(i => i.pasoId === pasoAnterior.id);
    return interaccion?.contenido ?? '';
  };

  if (loading && !data) return <div className="runner-center">Cargando...</div>;
  if (error) return <div className="runner-center">Error: {error}</div>;
  if (!data) return null;

  if (data.estado === 'generado') {
    return (
      <div className="runner-layout">
        <div className="card runner-card">
          <h1>{data.nombreActividad}</h1>
          <p>{data.descripcionActividad}</p>

          {!data.usuarioId ? (
            <div style={{ marginTop: 30, borderTop: '1px solid var(--color-bg-page)', paddingTop: 20 }}>
              <h3 style={{ marginBottom: 15 }}>Cuéntanos quién eres</h3>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Nombre Completo *</label>
                <input
                  className="input"
                  value={idenForm.nombre}
                  onChange={e => setIdenForm({ ...idenForm, nombre: e.target.value })}
                  placeholder="Tu nombre completo"
                />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Correo Electrónico *</label>
                <input
                  className="input"
                  type="email"
                  value={idenForm.email}
                  onChange={e => setIdenForm({ ...idenForm, email: e.target.value })}
                  placeholder="ejemplo@empresa.com"
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Cargo / Área</label>
                <input
                  className="input"
                  value={idenForm.cargo}
                  onChange={e => setIdenForm({ ...idenForm, cargo: e.target.value })}
                  placeholder="Ej: Director de Innovación"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleIdentificar}
                disabled={!idenForm.nombre.trim() || !idenForm.email.trim() || loading}
              >
                Identificarme y Comenzar
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 30 }}>
              <button className="btn btn-primary" onClick={handleIniciar}>Comenzar Actividad</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (data.estado === 'finalizado') {
    return (
      <div className="runner-layout">
        <div className="card runner-card" style={{ textAlign: 'center' }}>
          <div className="status-badge status-success" style={{ display: 'inline-block', marginBottom: 20 }}>Finalizado</div>
          <h1>¡Actividad Completada!</h1>
          <p>Tus respuestas han sido registradas exitosamente.</p>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 20 }}>Ya puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  const currentPaso = data.pasos[currentStepIndex];
  const progress = ((currentStepIndex) / data.pasos.length) * 100;

  return (
    <div className="runner-layout">
      <div className="runner-progress-bar">
        <div className="runner-progress-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="card runner-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            PASO {currentStepIndex + 1} DE {data.pasos.length}
          </span>
          <span className="status-badge status-warning">En progreso</span>
        </div>

        <h2 style={{ marginBottom: 10 }}>{currentPaso.titulo}</h2>
        {currentPaso.objetivo && (
          <p style={{ fontStyle: 'italic', color: 'var(--color-primary)', marginBottom: 20 }}>
            Objetivo: {currentPaso.objetivo}
          </p>
        )}

        {currentPaso.instrucciones && (
          <div style={{
            background: '#fdfcfe',
            padding: 15,
            borderRadius: 8,
            marginBottom: 20,
            borderLeft: '4px solid #a855f7',
            borderRight: '1px solid #e9d5ff',
            borderTop: '1px solid #e9d5ff',
            borderBottom: '1px solid #e9d5ff'
          }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#7e22ce', fontWeight: 'bold', marginBottom: 5 }}>INSTRUCCIONES METODOLÓGICAS</span>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#581c87', whiteSpace: 'pre-wrap' }}>{currentPaso.instrucciones}</p>
          </div>
        )}

        {currentPaso.promptIa && (
          <div style={{
            background: '#f1f5f9',
            padding: 15,
            borderRadius: 8,
            marginBottom: 20,
            borderLeft: '4px solid #64748b'
          }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', marginBottom: 5 }}>PROMPT IA DE REFERENCIA</span>
            <textarea
              className="input"
              rows={20}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              style={{ background: '#fff', fontSize: '0.9rem', color: '#334155', marginTop: 5 }}
            />
            <p style={{ margin: '5px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              Puedes ajustar este prompt para este intento. Solo afectará tu consulta actual.
            </p>
          </div>
        )}

        {/* Botón copiar respuesta del paso anterior — visible solo desde paso 2 en adelante */}
        {currentStepIndex > 0 && (() => {
          const respuestaAnterior = getRespuestaPasoAnterior();
          return respuestaAnterior ? (
            <div style={{
              marginBottom: 20,
              padding: '10px 14px',
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.82rem', color: '#92400e', flex: 1 }}>
                💬 <strong>Paso anterior:</strong> {respuestaAnterior.length > 120 ? respuestaAnterior.slice(0, 120) + '…' : respuestaAnterior}
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                onClick={() => setRespuesta(prev => prev ? prev + '\n\n' + respuestaAnterior : respuestaAnterior)}
              >
                📋 Copiar en mi respuesta
              </button>
              {currentPaso.usarIa && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  onClick={() => setCustomPrompt(prev => prev ? prev + '\n\n' + respuestaAnterior : respuestaAnterior)}
                >
                  🤖 Copiar en Prompt IA
                </button>
              )}
            </div>
          ) : null;
        })()}

        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontWeight: 500, margin: 0 }}>Tu Respuesta</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${userViewMode === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setUserViewMode('preview')}
              >
                👁️ Vista Previa
              </button>
              <button
                className={`btn ${userViewMode === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setUserViewMode('edit')}
              >
                ✏️ Editar
              </button>
            </div>
          </div>

          {userViewMode === 'preview' ? (
            <div style={{
              background: '#fdfcfe',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '1rem',
              fontSize: '0.9rem',
              color: '#334155',
              overflowX: 'auto',
              minHeight: '138px'
            }}>
              {!respuesta ? (
                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tu respuesta aparecerá aquí...</span>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1rem 0' }} {...props} />,
                    th: ({ node, ...props }) => <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f1f5f9', textAlign: 'left', fontWeight: 'bold' }} {...props} />,
                    td: ({ node, ...props }) => <td style={{ border: '1px solid #cbd5e1', padding: '10px' }} {...props} />,
                    p: ({ node, ...props }) => <p style={{ marginBottom: '1rem' }} {...props} />,
                    ul: ({ node, ...props }) => <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />,
                    ol: ({ node, ...props }) => <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />
                  }}
                >
                  {respuesta}
                </ReactMarkdown>
              )}
            </div>
          ) : (
            <textarea
              className="input"
              rows={20}
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)}
              placeholder="Escribe aquí tu respuesta..."
            />
          )}

          {/* Botón enviar a IA — debajo de Tu Respuesta para dejar claro que envía ese contenido */}
          {currentPaso.usarIa && (
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 16px', fontSize: '0.82rem', background: '#7c3aed', border: 'none' }}
                onClick={handleEnviarIA}
                disabled={!respuesta.trim() || enviandoIa}
              >
                {enviandoIa ? '⏳ Consultando IA...' : '✨ Enviar a ChatGPT'}
              </button>
            </div>
          )}
        </div>

        {/* Panel de IA — visible solo si el paso usa IA */}
        {currentPaso.usarIa && (
          <div style={{
            marginTop: 20,
            padding: '1rem 1.25rem',
            background: '#f8f7ff',
            border: '1px solid #c4b5fd',
            borderRadius: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <span style={{ fontWeight: 600, color: '#5b21b6', fontSize: '0.9rem' }}>🤖 Asistente IA</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn ${iaViewMode === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setIaViewMode('preview')}
                >
                  👁️ Vista Previa
                </button>
                <button
                  className={`btn ${iaViewMode === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setIaViewMode('edit')}
                >
                  ✏️ Editar
                </button>
              </div>
            </div>

            {iaViewMode === 'preview' ? (
              <div style={{
                background: '#fff',
                border: '1px solid #c4b5fd',
                borderRadius: '6px',
                padding: '1rem',
                fontSize: '0.9rem',
                color: '#334155',
                overflowX: 'auto'
              }}>
                {!respuestaIa ? (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>La respuesta de ChatGPT aparecerá aquí...</span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1rem 0' }} {...props} />,
                      th: ({ node, ...props }) => <th style={{ border: '1px solid #cbd5e1', padding: '10px', background: '#f1f5f9', textAlign: 'left', fontWeight: 'bold' }} {...props} />,
                      td: ({ node, ...props }) => <td style={{ border: '1px solid #cbd5e1', padding: '10px' }} {...props} />,
                      p: ({ node, ...props }) => <p style={{ marginBottom: '1rem' }} {...props} />,
                      ul: ({ node, ...props }) => <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />,
                      ol: ({ node, ...props }) => <ol style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }} {...props} />
                    }}
                  >
                    {respuestaIa}
                  </ReactMarkdown>
                )}
              </div>
            ) : (
              <textarea
                className="input"
                rows={20}
                value={respuestaIa}
                onChange={e => setRespuestaIa(e.target.value)}
                placeholder="La respuesta de ChatGPT aparecerá aquí..."
                style={{ background: '#fff', borderColor: '#c4b5fd', fontSize: '0.9rem' }}
              />
            )}
          </div>
        )}

        <div style={{ marginTop: 30, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleSiguiente}
            disabled={
              (currentPaso.usarIa ? !respuestaIa.trim() : !respuesta.trim()) || loading
            }
          >
            {currentStepIndex === data.pasos.length - 1 ? 'Finalizar Actividad' : 'Siguiente Paso'}
          </button>
        </div>
      </div>
    </div>
  );
}
