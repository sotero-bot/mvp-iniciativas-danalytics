import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { WysiwygEditor, WysiwygEditorHandle } from '../../components/WysiwygEditor';

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

/* ── Brand header ── */
function RunnerHeader() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 52,
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(226,232,240,0.8)',
      display: 'flex', alignItems: 'center', padding: '0 1.5rem',
      gap: 10,
    }}>
      <div style={{
        width: 26, height: 26,
        background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
        borderRadius: 7,
        boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
        flexShrink: 0,
      }} />
      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A', letterSpacing: '-0.03em' }}>
        IAGobernanza
      </span>
    </div>
  );
}

/* ── Step pills ── */
function StepPills({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: 6,
          flex: 1,
          maxWidth: 48,
          borderRadius: 9999,
          background: i < current ? '#2563EB' : i === current ? '#93C5FD' : '#E2E8F0',
          transition: 'background 0.3s ease',
        }} />
      ))}
    </div>
  );
}

export function RunnerPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RunnerData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [respuesta, setRespuesta] = useState('');
  const [respuestaIa, setRespuestaIa] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [enviandoIa, setEnviandoIa] = useState(false);
  const [archivoIa, setArchivoIa] = useState<File | null>(null);
  const [iaViewMode, setIaViewMode] = useState<'preview' | 'edit'>('preview');
  const [idenForm, setIdenForm] = useState({ nombre: '', email: '', cargo: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const editorRef = useRef<WysiwygEditorHandle>(null);
  const iaEditorRef = useRef<WysiwygEditorHandle>(null);

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/execution/${token}`);
      if (!res.ok) throw new Error('No se pudo cargar la actividad');
      const json = await res.json();
      setData(json);

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

  useEffect(() => { loadData(); }, [token]);

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
      setData(prev => prev ? {
        ...prev,
        interacciones: [...prev.interacciones.filter(i => i.pasoId !== paso.id),
          { pasoId: paso.id, contenido: respuestaFinal, fecha: new Date().toISOString() } as any]
      } : prev);

      setCurrentStepIndex(currentStepIndex + 1);
      setRespuesta('');
      setRespuestaIa('');
      setArchivoIa(null);
      editorRef.current?.replaceContent('');
      iaEditorRef.current?.replaceContent('');
      setCustomPrompt(data!.pasos[currentStepIndex + 1]?.promptIa ?? '');
    } else {
      await fetch(`${API_URL}/execution/${token}/finalizar`, { method: 'POST' });
      await loadData();
    }
    setLoading(false);
  };

  const handleEnviarIA = async () => {
    if (!respuesta.trim() && !archivoIa) return alert('Por favor escriba su respuesta o adjunte un archivo antes de consultar a la IA');
    setEnviandoIa(true);
    setRespuestaIa('');
    iaEditorRef.current?.replaceContent('');

    const paso = data!.pasos[currentStepIndex];

    try {
      const formData = new FormData();
      formData.append('pasoId', paso.id);
      formData.append('respuesta', respuesta);
      if (customPrompt) formData.append('customPrompt', customPrompt);
      if (archivoIa) formData.append('archivo', archivoIa);

      const res = await fetch(`${API_URL}/execution/${token}/ia`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Error al consultar la IA');

      const json = await res.json();
      setRespuestaIa(json.respuestaIa);
      iaEditorRef.current?.replaceContent(json.respuestaIa);
    } catch (err: any) {
      alert('Error en Asistente IA: ' + err.message);
    } finally {
      setEnviandoIa(false);
    }
  };

  const getRespuestaPasoAnterior = (): string => {
    if (!data || currentStepIndex === 0) return '';
    const pasoAnterior = data.pasos[currentStepIndex - 1];
    return data.interacciones.find(i => i.pasoId === pasoAnterior.id)?.contenido ?? '';
  };

  /* ── Loading / Error ── */
  if (loading && !data) return (
    <>
      <RunnerHeader />
      <div className="runner-center" style={{ paddingTop: 52 }}>
        <div style={{ width: 20, height: 20, border: '2px solid #DBEAFE', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Cargando actividad...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );

  if (error) return (
    <>
      <RunnerHeader />
      <div className="runner-center" style={{ paddingTop: 52, color: '#EF4444' }}>⚠ {error}</div>
    </>
  );

  if (!data) return null;

  /* ── Estado: generado (identificación + inicio) ── */
  if (data.estado === 'generado') {
    return (
      <>
        <RunnerHeader />
        <div className="runner-layout" style={{ paddingTop: 88 }}>
          <div className="card runner-card">

            {/* Activity info */}
            <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#EFF6FF', color: '#2563EB',
                padding: '4px 14px', borderRadius: 9999,
                fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em',
                marginBottom: 16,
              }}>
                ACTIVIDAD
              </div>
              <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>{data.nombreActividad}</h1>
              {data.descripcionActividad && (
                <p style={{ maxWidth: 500, margin: '0 auto', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  {data.descripcionActividad}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{data.pasos.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>pasos</div>
                </div>
              </div>
            </div>

            {/* Identification form or start */}
            {!data.usuarioId ? (
              <form
                className={wasValidated ? 'was-validated' : ''}
                onSubmit={(e) => { e.preventDefault(); setWasValidated(true); if (e.currentTarget.checkValidity()) handleIdentificar(); }}
                noValidate
              >
                <h3 style={{ marginBottom: 4 }}>Cuéntenos quién es</h3>
                <p style={{ marginBottom: 24, fontSize: '0.875rem' }}>Esta información quedará asociada a sus respuestas.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>Nombre Completo</label>
                    <input className="input" required value={idenForm.nombre}
                      onChange={e => setIdenForm({ ...idenForm, nombre: e.target.value })}
                      placeholder="Su nombre completo" />
                    <div className="invalid-feedback">El nombre completo es requerido.</div>
                  </div>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>Correo Electrónico</label>
                    <input className="input" type="email" required value={idenForm.email}
                      onChange={e => setIdenForm({ ...idenForm, email: e.target.value })}
                      placeholder="ejemplo@empresa.com" />
                    <div className="invalid-feedback">Un correo electrónico válido es requerido.</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>Cargo / Área</label>
                    <input className="input" value={idenForm.cargo}
                      onChange={e => setIdenForm({ ...idenForm, cargo: e.target.value })}
                      placeholder="Ej: Director de Innovación" />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}
                  style={{ marginTop: 28, width: '100%', padding: '0.75rem', fontSize: '0.9375rem' }}>
                  {loading ? 'Registrando...' : 'Comenzar actividad →'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: 24 }}>Ya está identificado. Cuando esté listo, puede comenzar la actividad.</p>
                <button className="btn btn-primary" onClick={handleIniciar} disabled={loading}
                  style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem' }}>
                  {loading ? 'Iniciando...' : 'Comenzar actividad →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  /* ── Estado: finalizado ── */
  if (data.estado === 'finalizado') {
    return (
      <>
        <RunnerHeader />
        <div className="runner-layout" style={{ paddingTop: 88 }}>
          <div className="card runner-card" style={{ textAlign: 'center', padding: '3rem 2.25rem' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', fontSize: '1.75rem',
            }}>✓</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>¡Actividad completada!</h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32, maxWidth: 380, margin: '0 auto 32px' }}>
              Sus respuestas han sido registradas exitosamente. Puede ver un resumen completo a continuación.
            </p>
            <a href={`/runner/${token}/resultados`} className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem', textDecoration: 'none', display: 'inline-flex' }}>
              Ver mis resultados →
            </a>
            <p style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
              También puede cerrar esta ventana.
            </p>
          </div>
        </div>
      </>
    );
  }

  /* ── Estado: iniciado (ejecución paso a paso) ── */
  const currentPaso = data.pasos[currentStepIndex];
  const progress = (currentStepIndex / data.pasos.length) * 100;
  const respuestaAnterior = getRespuestaPasoAnterior();
  const isLastStep = currentStepIndex === data.pasos.length - 1;

  return (
    <>
      <RunnerHeader />

      {/* Progress bar */}
      <div className="runner-progress-bar" style={{ top: 52 }}>
        <div className="runner-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="runner-layout" style={{ paddingTop: 88 }}>
        <div className="runner-card card">

          {/* Step meta */}
          <div style={{ marginBottom: 24 }}>
            <StepPills total={data.pasos.length} current={currentStepIndex} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Paso {currentStepIndex + 1} de {data.pasos.length}
              </span>
              {isLastStep && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '2px 10px', borderRadius: 9999 }}>
                  Último paso
                </span>
              )}
            </div>
          </div>

          {/* Step title & objective */}
          <h2 style={{ fontSize: '1.375rem', marginBottom: currentPaso.objetivo ? 8 : 20 }}>
            {currentPaso.titulo}
          </h2>
          {currentPaso.objetivo && (
            <p style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontStyle: 'italic', marginBottom: 20, fontWeight: 500 }}>
              {currentPaso.objetivo}
            </p>
          )}

          {/* Instructions */}
          {currentPaso.instrucciones && (
            <div style={{
              background: '#FDFCFF',
              padding: '1rem 1.25rem',
              borderRadius: 8,
              marginBottom: 20,
              borderLeft: '3px solid #A855F7',
              border: '1px solid #EDE9FE',
              borderLeftWidth: 3,
              borderLeftColor: '#A855F7',
            }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#7C3AED', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Instrucciones
              </span>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#4C1D95', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {currentPaso.instrucciones}
              </p>
            </div>
          )}

          {/* Prompt IA */}
          {currentPaso.promptIa && (
            <div style={{
              background: '#F8FAFC',
              padding: '1rem 1.25rem',
              borderRadius: 8,
              marginBottom: 20,
              border: '1px solid var(--color-border)',
            }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Prompt IA de referencia
              </span>
              <textarea
                className="input"
                rows={10}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, resize: 'vertical' }}
              />
              <p style={{ margin: '6px 0 0', fontSize: '0.73rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                Puede ajustar este prompt. Solo afectará su consulta actual.
              </p>
            </div>
          )}

          {/* Previous step hint */}
          {respuestaAnterior && (
            <div style={{
              marginBottom: 20,
              padding: '0.875rem 1rem',
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#B45309', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Respuesta anterior
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400E', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {respuestaAnterior}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignSelf: 'center' }}>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => editorRef.current?.insertContent(respuestaAnterior)}>
                  Copiar en respuesta
                </button>
                {currentPaso.usarIa && (
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => setCustomPrompt(prev => prev ? prev + '\n\n' + respuestaAnterior : respuestaAnterior)}>
                    Copiar en prompt
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Response area */}
          <div style={{ marginBottom: currentPaso.usarIa ? 0 : 28 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 8, color: 'var(--color-text-main)' }}>
              Tu respuesta
            </label>
            <WysiwygEditor
              ref={editorRef}
              value={respuesta}
              onChange={setRespuesta}
              placeholder="Escriba aquí su respuesta..."
              minHeight={220}
            />

            {/* File attachment */}
            {currentPaso.usarIa && (
              <div style={{
                marginTop: 10,
                padding: '10px 14px',
                background: '#FAFAFE',
                border: '1px dashed #C4B5FD',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '0.8rem', color: '#6D28D9', fontWeight: 500 }}>Adjuntar archivo</span>
                <span style={{ fontSize: '0.73rem', color: 'var(--color-text-tertiary)' }}>PDF, Word, Excel — máx. 10 MB</span>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', fontSize: '0.78rem',
                  background: '#EDE9FE', color: '#5B21B6',
                  borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                  border: '1px solid #C4B5FD',
                }}>
                  {archivoIa ? `✓ ${archivoIa.name}` : '📂 Seleccionar archivo'}
                  <input type="file" accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.xml"
                    style={{ display: 'none' }}
                    onChange={e => setArchivoIa(e.target.files?.[0] || null)} />
                </label>
                {archivoIa && (
                  <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                    onClick={() => setArchivoIa(null)}>✕ Quitar</button>
                )}
              </div>
            )}
          </div>

          {/* IA Panel */}
          {currentPaso.usarIa && (
            <div style={{
              marginTop: 16,
              border: '1px solid #DDD6FE',
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              {/* IA Header */}
              <div style={{
                padding: '0.875rem 1.25rem',
                background: 'linear-gradient(135deg, #F5F3FF, #FAF8FF)',
                borderBottom: '1px solid #EDE9FE',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem',
                  }}>✨</div>
                  <span style={{ fontWeight: 600, color: '#4C1D95', fontSize: '0.875rem' }}>Asistente IA</span>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontSize: '0.8rem', background: '#7C3AED', boxShadow: '0 1px 2px rgba(109,40,217,0.3)' }}
                  onClick={handleEnviarIA}
                  disabled={(!respuesta.trim() && !archivoIa) || enviandoIa}
                >
                  {enviandoIa ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      Consultando...
                    </span>
                  ) : 'Enviar a ChatGPT'}
                </button>
              </div>

              {/* IA Editor */}
              <div style={{ padding: '1rem 1.25rem', background: '#FDFCFF' }}>
                {enviandoIa && !respuestaIa && (
                  <div style={{
                    padding: '2rem', textAlign: 'center', color: '#7C3AED',
                    fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}>
                    <span style={{ width: 16, height: 16, border: '2px solid #DDD6FE', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Generando respuesta con IA...
                  </div>
                )}
                <WysiwygEditor
                  ref={iaEditorRef}
                  value={respuestaIa}
                  onChange={setRespuestaIa}
                  placeholder="La respuesta de ChatGPT aparecerá aquí. Puede editarla antes de continuar."
                  minHeight={200}
                  borderColor="#DDD6FE"
                />
              </div>
            </div>
          )}

          {/* Next / Finish button */}
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleSiguiente}
              disabled={(currentPaso.usarIa ? !respuestaIa.trim() : !respuesta.trim()) || loading}
              style={{ padding: '0.625rem 1.5rem', fontSize: '0.9375rem' }}
            >
              {loading ? 'Guardando...' : isLastStep ? 'Finalizar actividad' : 'Siguiente paso →'}
            </button>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
