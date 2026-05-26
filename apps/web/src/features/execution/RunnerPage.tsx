import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WysiwygEditor, WysiwygEditorHandle } from '../../components/WysiwygEditor';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Toast } from '../../components/Toast';
import { buildResumenHtml } from './buildResumenHtml';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Paso {
  id: string;
  titulo: string;
  objetivo?: string;
  instrucciones?: string;
  usarIa?: boolean;
  iaAutomatica?: boolean;
  promptIa?: string;
  permitirArchivo?: boolean;
  soloArchivo?: boolean;
  urlPlantilla?: string;
}

interface RespuestaAnterior {
  pasoTitulo: string;
  pasoOrden: number;
  contenido?: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
}

interface RunnerData {
  estado: string;
  nombreActividad: string;
  descripcionActividad?: string;
  nombreEmpresa?: string;
  logoEmpresa?: string;
  usuarioId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  usuario?: { nombre: string; email: string; cargo?: string | null; area?: string | null };
  pasos: Paso[];
  interacciones: { pasoId: string; contenido: string; respuestaUsuario?: string; respuestaIa?: string; archivoNombre?: string }[];
  plantillaAnterior?: { nombre: string; respuestas: RespuestaAnterior[] };
}

/* ── Brand header ── */
function RunnerHeader({ nombreActividad, nombreEmpresa, logoEmpresa }: {
  nombreActividad?: string;
  nombreEmpresa?: string;
  logoEmpresa?: string;
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 52,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(226,232,240,0.8)',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      padding: '0 1.5rem',
    }}>
      <img
        src="/logo-horizontal.png"
        alt="Danalytics"
        style={{ height: 36, objectFit: 'contain', flexShrink: 0, justifySelf: 'start' }}
      />

      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', letterSpacing: '-0.02em' }}>
        Decisión IA
      </span>

      {(nombreEmpresa || nombreActividad) ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'end',
          overflow: 'hidden', minWidth: 0,
        }}>
          <div style={{ width: 1, height: 20, background: '#E2E8F0', flexShrink: 0 }} />
          {logoEmpresa ? (
            <img src={logoEmpresa} alt={nombreEmpresa}
              style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'contain', flexShrink: 0, border: '1px solid #E2E8F0' }} />
          ) : nombreEmpresa ? (
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #2563EB, #0F172A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', fontWeight: 700, color: 'white',
            }}>
              {nombreEmpresa.charAt(0).toUpperCase()}
            </div>
          ) : null}
          <span style={{
            fontSize: '0.78rem', color: '#475569', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {nombreEmpresa && <span style={{ fontWeight: 600 }}>{nombreEmpresa}</span>}
            {nombreEmpresa && nombreActividad && <span style={{ color: '#CBD5E1', margin: '0 5px' }}>·</span>}
            {nombreActividad && <span>{nombreActividad}</span>}
          </span>
        </div>
      ) : <div />}
    </div>
  );
}

/* ── Section block ── */
function SectionBlock({
  number, title, description, color, children,
}: {
  number: number; title: string; description?: string;
  color: 'blue' | 'violet' | 'purple'; children: React.ReactNode;
}) {
  const palette = {
    blue:   { bg: '#EFF6FF', border: '#BFDBFE', accent: '#2563EB', titleColor: '#1D4ED8', descColor: '#3B82F6' },
    violet: { bg: '#FDFCFF', border: '#EDE9FE', accent: '#7C3AED', titleColor: '#5B21B6', descColor: '#7C3AED' },
    purple: { bg: '#F5F3FF', border: '#DDD6FE', accent: '#8B5CF6', titleColor: '#6D28D9', descColor: '#7C3AED' },
  };
  const p = palette[color];
  return (
    <div style={{ border: `1px solid ${p.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '0.75rem 1.25rem', background: p.bg, borderBottom: `1px solid ${p.border}`,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', background: p.accent, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, marginTop: 1,
        }}>{number}</div>
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: p.titleColor, display: 'block' }}>{title}</span>
          {description && (
            <span style={{ fontSize: '0.78rem', color: p.descColor, opacity: 0.85, marginTop: 1, display: 'block' }}>{description}</span>
          )}
        </div>
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>{children}</div>
    </div>
  );
}

/* ── Activity branding ── */
function ActivityBranding({ nombreActividad, nombreEmpresa, logoEmpresa, border = false }: {
  nombreActividad: string;
  nombreEmpresa?: string;
  logoEmpresa?: string;
  border?: boolean;
}) {
  return (
    <div style={{
      textAlign: 'center',
      marginBottom: 20,
      ...(border ? { paddingBottom: 20, borderBottom: '1px solid var(--color-border)' } : {}),
    }}>
      {logoEmpresa ? (
        <img src={logoEmpresa} alt={nombreEmpresa}
          style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'contain', border: '1px solid #E2E8F0', background: '#fff', display: 'block', margin: '0 auto 10px' }} />
      ) : nombreEmpresa ? (
        <div style={{
          width: 64, height: 64, borderRadius: 12,
          background: 'linear-gradient(135deg, #2563EB, #0F172A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', fontWeight: 700, color: 'white',
          margin: '0 auto 10px',
        }}>
          {nombreEmpresa.charAt(0).toUpperCase()}
        </div>
      ) : null}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
        {nombreEmpresa || nombreActividad}
      </h2>
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

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function interpolarPrompt(
  prompt: string,
  pasos: Paso[],
  interacciones: RunnerData['interacciones']
): string {
  if (!prompt.includes('{{paso_')) return prompt;
  return prompt.replace(/\{\{paso_(\d+)\}\}/g, (_match, nStr) => {
    const n = parseInt(nStr, 10);
    const paso = pasos[n - 1];
    if (!paso) return `[paso ${n} no encontrado]`;
    const interaccion = interacciones.find(i => i.pasoId === paso.id);
    if (!interaccion) return '[sin respuesta]';
    return stripHtmlToText(interaccion.contenido);
  });
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
  const [archivoRespuesta, setArchivoRespuesta] = useState<File | null>(null);
  const [idenForm, setIdenForm] = useState({ nombre: '', email: '', cargo: '', area: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [showPromptEdit, setShowPromptEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'info' } | null>(null);
  const [bloqueadoPor, setBloqueadoPor] = useState<string | null>(null);
  const [plantillaAnteriorExpanded, setPlantillaAnteriorExpanded] = useState(false);
  const editorRef = useRef<WysiwygEditorHandle>(null);
  const iaEditorRef = useRef<WysiwygEditorHandle>(null);
  const autoIaRunRef = useRef<Set<string>>(new Set());

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/execution/${token}`);
      if (!res.ok) throw new Error('No se pudo cargar la actividad');
      const json = await res.json();
      setData(json);

      let stepIndexToLoad = 0;

      if (json.estado !== 'generado') {
        const lastAnsweredIndex = json.pasos.findIndex((p: Paso) =>
          !json.interacciones.some((i: any) => i.pasoId === p.id)
        );
        if (lastAnsweredIndex !== -1) {
          stepIndexToLoad = lastAnsweredIndex;
          setCurrentStepIndex(lastAnsweredIndex);
          if (json.pasos[lastAnsweredIndex].promptIa) {
            setCustomPrompt(interpolarPrompt(json.pasos[lastAnsweredIndex].promptIa, json.pasos, json.interacciones));
          }
        } else if (json.estado === 'finalizado') {
          setCurrentStepIndex(json.pasos.length);
          stepIndexToLoad = -1;
        } else {
          // Todos los pasos respondidos pero aún no finalizado → ir al último paso
          const lastIdx = json.pasos.length - 1;
          stepIndexToLoad = lastIdx;
          setCurrentStepIndex(lastIdx);
          if (json.pasos[lastIdx]?.promptIa) {
            setCustomPrompt(interpolarPrompt(json.pasos[lastIdx].promptIa, json.pasos, json.interacciones));
          }
        }
      } else if (json.pasos.length > 0 && json.pasos[0].promptIa) {
        setCustomPrompt(interpolarPrompt(json.pasos[0].promptIa, json.pasos, json.interacciones));
      }

      if (stepIndexToLoad >= 0 && json.pasos[stepIndexToLoad]) {
        const paso = json.pasos[stepIndexToLoad];
        const inter = json.interacciones.find((i: any) => i.pasoId === paso.id);
        if (inter) {
          if (paso.usarIa && !paso.iaAutomatica) {
            setRespuesta(inter.respuestaUsuario || '');
            setRespuestaIa(inter.respuestaIa || inter.contenido || '');
          } else if (!paso.usarIa) {
            setRespuesta(inter.contenido || '');
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [token]);

  useEffect(() => {
    if (!data) return;
    const paso = data.pasos[currentStepIndex];
    if (!paso?.usarIa || !paso?.iaAutomatica) return;
    if (autoIaRunRef.current.has(paso.id)) return;
    const interExistente = data.interacciones.find(i => i.pasoId === paso.id);
    if (interExistente?.respuestaIa) {
      setRespuestaIa(interExistente.respuestaIa);
      iaEditorRef.current?.replaceContent(interExistente.respuestaIa);
      return;
    }
    autoIaRunRef.current.add(paso.id);
    const runAutoIa = async () => {
      setEnviandoIa(true);
      setRespuestaIa('');
      iaEditorRef.current?.replaceContent('');
      try {
        const interpolado = interpolarPrompt(paso.promptIa ?? '', data.pasos, data.interacciones);
        const formData = new FormData();
        formData.append('pasoId', paso.id);
        formData.append('respuesta', '');
        if (interpolado) formData.append('customPrompt', interpolado);
        const res = await fetch(`${API_URL}/execution/${token}/ia`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setRespuestaIa(json.respuestaIa);
        iaEditorRef.current?.replaceContent(json.respuestaIa);

        // Si el paso también tiene subida de archivo, auto-guardamos la respuesta IA
        // para que el endpoint de pre-llenado del Excel pueda leerla desde la BD
        if (paso.soloArchivo || paso.permitirArchivo) {
          await fetch(`${API_URL}/execution/${token}/responder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pasoId: paso.id, contenido: json.respuestaIa, respuestaIa: json.respuestaIa }),
          });
          setData(prev => prev ? {
            ...prev,
            interacciones: [
              ...prev.interacciones.filter(i => i.pasoId !== paso.id),
              { pasoId: paso.id, contenido: json.respuestaIa, respuestaIa: json.respuestaIa },
            ],
          } : prev);
        }
      } catch {
        autoIaRunRef.current.delete(paso.id);
        setEnviandoIa(false);
      } finally {
        setEnviandoIa(false);
      }
    };
    runAutoIa();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, data?.estado]);

  const handleIniciar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/execution/${token}/iniciar`, { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json();
        if (res.status === 403) {
          setBloqueadoPor(errJson.message || 'Para acceder, primero completá la actividad anterior.');
          return;
        }
        throw new Error(errJson.message || 'Algo salió mal al iniciar la actividad');
      }
      await loadData();
    } catch (err: any) {
      alert('Algo salió mal al iniciar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleIdentificar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/execution/${token}/identificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idenForm)
      });
      if (!res.ok) throw new Error('Error al registrar identificación');
      const result = await res.json();

      const activeToken: string = result.instanceToken ?? token;

      if (activeToken !== token) {
        window.location.replace(`/runner/${activeToken}`);
        return;
      }

      const res2 = await fetch(`${API_URL}/execution/${activeToken}/iniciar`, { method: 'POST' });
      if (!res2.ok) {
        const errJson = await res2.json();
        if (res2.status === 403) {
          setBloqueadoPor(errJson.message || 'Para acceder, primero completá la actividad anterior.');
          await loadData();
          return;
        }
        throw new Error(errJson.message || 'Algo salió mal al iniciar la actividad');
      }
      await loadData();
      if (result.reutilizado) {
        setToast({ message: `Bienvenido de vuelta, ${result.nombre}`, variant: 'info' });
      } else {
        setToast({ message: 'Registro exitoso', variant: 'success' });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitIdentificacion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWasValidated(true);
    if (!(e.currentTarget as HTMLFormElement).checkValidity()) return;
    setShowEmailConfirm(true);
  };

  const handleDescargarPlantillaPrediligenciada = async (pasoId: string) => {
    setDescargandoExcel(true);
    try {
      const res = await fetch(`${API_URL}/execution/${token}/plantilla-prefilled/${pasoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestaIa: respuestaIa || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as any).message || 'No se pudo generar la plantilla. Espera a que el asistente IA finalice.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-priorizacion.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al descargar la plantilla. Intentá de nuevo.');
    } finally {
      setDescargandoExcel(false);
    }
  };

  const handleSiguiente = async () => {
    const paso = data!.pasos[currentStepIndex];
    const respuestaFinal = paso.usarIa ? respuestaIa : respuesta;

    if (!respuestaFinal.trim() && !archivoRespuesta) {
      if (paso.usarIa && !respuestaIa.trim()) {
        return alert('Consultá al asistente antes de continuar.');
      }
      if (paso.permitirArchivo) {
        return alert('Escribí tu respuesta o adjuntá el archivo para continuar.');
      }
      return;
    }

    setLoading(true);

    let responderRes: Response;
    if (archivoRespuesta) {
      const formData = new FormData();
      formData.append('pasoId', paso.id);
      formData.append('contenido', respuestaFinal);
      formData.append('archivo', archivoRespuesta);
      responderRes = await fetch(`${API_URL}/execution/${token}/responder`, { method: 'POST', body: formData });
    } else {
      responderRes = await fetch(`${API_URL}/execution/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pasoId: paso.id,
          contenido: respuestaFinal,
          respuestaUsuario: paso.usarIa ? respuesta : undefined,
          respuestaIa: paso.usarIa ? respuestaIa : undefined,
        })
      });
    }

    if (!responderRes.ok) {
      setLoading(false);
      return alert('Error al guardar la respuesta. Por favor intentá de nuevo.');
    }

    if (currentStepIndex < data!.pasos.length - 1) {
      const interActual = {
        pasoId: paso.id,
        contenido: respuestaFinal,
        respuestaUsuario: paso.usarIa ? respuesta : undefined,
        respuestaIa: paso.usarIa ? respuestaIa : undefined,
        archivoNombre: archivoRespuesta?.name,
      };
      const newInteracciones = [
        ...data!.interacciones.filter(i => i.pasoId !== paso.id),
        interActual,
      ];
      setData(prev => prev ? { ...prev, interacciones: newInteracciones } : prev);

      const sig = data!.pasos[currentStepIndex + 1];
      const interSig = newInteracciones.find(i => i.pasoId === sig.id);
      if (interSig) {
        if (sig.usarIa) {
          setRespuesta(interSig.respuestaUsuario || '');
          setRespuestaIa(interSig.respuestaIa || interSig.contenido || '');
          editorRef.current?.replaceContent(interSig.respuestaUsuario || '');
          iaEditorRef.current?.replaceContent(interSig.respuestaIa || interSig.contenido || '');
        } else {
          setRespuesta(interSig.contenido || '');
          setRespuestaIa('');
          editorRef.current?.replaceContent(interSig.contenido || '');
          iaEditorRef.current?.replaceContent('');
        }
      } else {
        setRespuesta('');
        setRespuestaIa('');
        editorRef.current?.replaceContent('');
        iaEditorRef.current?.replaceContent('');
      }

      setCurrentStepIndex(currentStepIndex + 1);
      setArchivoIa(null);
      setArchivoRespuesta(null);
      setCustomPrompt(interpolarPrompt(sig.promptIa ?? '', data!.pasos, newInteracciones));
    } else {
      await fetch(`${API_URL}/execution/${token}/finalizar`, { method: 'POST' });
      await loadData();
    }
    setLoading(false);
  };

  const handleEnviarIA = async () => {
    const paso = data!.pasos[currentStepIndex];
    if (!paso.iaAutomatica && !respuesta.trim() && !archivoIa) return alert('Escribí tu respuesta o adjuntá un archivo para consultar al asistente.');
    setEnviandoIa(true);
    setRespuestaIa('');
    iaEditorRef.current?.replaceContent('');

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
      alert('No pudimos conectar con el asistente. Intentá de nuevo.');
    } finally {
      setEnviandoIa(false);
    }
  };

  const getRespuestaPasoAnterior = (): string => {
    if (!data || currentStepIndex === 0) return '';
    const pasoAnterior = data.pasos[currentStepIndex - 1];
    return data.interacciones.find(i => i.pasoId === pasoAnterior.id)?.contenido ?? '';
  };

  const handleAnterior = async () => {
    if (currentStepIndex === 0) return;
    const pasoActual = data!.pasos[currentStepIndex];
    const tieneAlgoEscrito = respuesta.trim() || respuestaIa.trim();

    setLoading(true);

    if (tieneAlgoEscrito) {
      const contenidoFinal = pasoActual.usarIa ? (respuestaIa || respuesta) : respuesta;
      await fetch(`${API_URL}/execution/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pasoId: pasoActual.id,
          contenido: contenidoFinal,
          respuestaUsuario: pasoActual.usarIa ? respuesta : undefined,
          respuestaIa: pasoActual.usarIa ? respuestaIa : undefined,
        })
      });
      setData(prev => prev ? {
        ...prev,
        interacciones: [
          ...prev.interacciones.filter(i => i.pasoId !== pasoActual.id),
          {
            pasoId: pasoActual.id,
            contenido: contenidoFinal,
            respuestaUsuario: pasoActual.usarIa ? respuesta : undefined,
            respuestaIa: pasoActual.usarIa ? respuestaIa : undefined,
          }
        ]
      } : prev);
    }

    const nuevoIndex = currentStepIndex - 1;
    const pasoAnterior = data!.pasos[nuevoIndex];
    const inter = data!.interacciones.find(i => i.pasoId === pasoAnterior.id);

    if (pasoAnterior.usarIa) {
      setRespuesta(inter?.respuestaUsuario || '');
      setRespuestaIa(inter?.respuestaIa || inter?.contenido || '');
      editorRef.current?.replaceContent(inter?.respuestaUsuario || '');
      iaEditorRef.current?.replaceContent(inter?.respuestaIa || inter?.contenido || '');
    } else {
      setRespuesta(inter?.contenido || '');
      setRespuestaIa('');
      editorRef.current?.replaceContent(inter?.contenido || '');
      iaEditorRef.current?.replaceContent('');
    }

    setCurrentStepIndex(nuevoIndex);
    setArchivoIa(null);
    setArchivoRespuesta(null);
    setCustomPrompt(interpolarPrompt(pasoAnterior.promptIa ?? '', data!.pasos, data!.interacciones));
    setLoading(false);
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
        <RunnerHeader nombreActividad={data.nombreActividad} nombreEmpresa={data.nombreEmpresa} logoEmpresa={data.logoEmpresa} />
        <div className="runner-layout" style={{ paddingTop: 88 }}>
          <div className="card runner-card">

            {/* Activity info */}
            <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--color-border)' }}>

              <ActivityBranding
                nombreActividad={data.nombreActividad}
                nombreEmpresa={data.nombreEmpresa}
                logoEmpresa={data.logoEmpresa}
              />
              {data.descripcionActividad && (
                <p style={{ maxWidth: 500, margin: '0 auto', color: 'var(--color-text-secondary)', lineHeight: 1.7, textAlign: 'justify' }}>
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

            {/* Pantalla de bloqueo */}
            {bloqueadoPor ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.25rem', fontSize: '1.75rem',
                }}>🔒</div>
                <h3 style={{ margin: '0 0 10px', color: '#92400E' }}>Aún no disponible</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.6 }}>
                  {bloqueadoPor}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', margin: 0 }}>
                  Una vez que completes la actividad anterior, regresa aquí para continuar.
                </p>
              </div>
            ) : !data.usuarioId ? (
              <form
                className={wasValidated ? 'was-validated' : ''}
                onSubmit={onSubmitIdentificacion}
                noValidate
              >
                <h3 style={{ marginBottom: 4 }}>Indícanos quién eres</h3>
                <p style={{ marginBottom: 24, fontSize: '0.875rem' }}>
                  Estos datos quedarán vinculados a tu participación en la actividad.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>Correo Electrónico</label>
                    <input className="input" type="email" required value={idenForm.email}
                      onChange={e => setIdenForm({ ...idenForm, email: e.target.value })}
                      onBlur={async e => {
                        const email = e.target.value.trim();
                        if (!email || !/\S+@\S+\.\S+/.test(email)) return;
                        try {
                          const res = await fetch(`${API_URL}/execution/${token}/usuario?email=${encodeURIComponent(email)}`);
                          if (res.ok) {
                            const u = await res.json();
                            setIdenForm(f => ({ ...f, nombre: u.nombre, cargo: u.cargo ?? f.cargo, area: u.area ?? f.area }));
                          }
                        } catch { /* sin usuario previo, no hacer nada */ }
                      }}
                      placeholder="ejemplo@empresa.com" />
                    <div className="invalid-feedback">Ingresá un correo electrónico válido.</div>
                  </div>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>Nombre Completo</label>
                    <input className="input" required value={idenForm.nombre}
                      onChange={e => setIdenForm({ ...idenForm, nombre: e.target.value })}
                      placeholder="Su nombre completo" />
                    <div className="invalid-feedback">Ingresá tu nombre completo.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>Cargo</label>
                      <input className="input" value={idenForm.cargo}
                        onChange={e => setIdenForm({ ...idenForm, cargo: e.target.value })}
                        placeholder="Ej: Director de Innovación" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>Área</label>
                      <input className="input" value={idenForm.area}
                        onChange={e => setIdenForm({ ...idenForm, area: e.target.value })}
                        placeholder="Ej: Tecnología" />
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}
                  style={{ marginTop: 28, width: '100%', padding: '0.75rem', fontSize: '0.9375rem' }}>
                  {loading ? 'Registrando...' : 'Comenzar actividad →'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <button className="btn btn-primary" onClick={handleIniciar} disabled={loading}
                  style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem' }}>
                  {loading ? 'Iniciando...' : 'Comenzar actividad →'}
                </button>
              </div>
            )}
          </div>
        </div>

        <ConfirmModal
          isOpen={showEmailConfirm}
          title="Confirma tu correo electrónico"
          message={`Estás a punto de registrarte con:\n\n${idenForm.email}\n\nTu correo es tu llave única. Si ya estás registrado, usaremos tu cuenta existente. Si este no es tu correo, haz clic en cancelar y corrígelo.`}
          confirmLabel="Confirmar y comenzar"
          onConfirm={() => { setShowEmailConfirm(false); handleIdentificar(); }}
          onCancel={() => setShowEmailConfirm(false)}
        />
      </>
    );
  }

  /* ── Estado: finalizado ── */
  const handleDescargarResumen = () => {
    const html = buildResumenHtml({
      nombreActividad: data!.nombreActividad,
      descripcionActividad: data!.descripcionActividad,
      nombreEmpresa: data!.nombreEmpresa,
      logoEmpresa: data!.logoEmpresa,
      fechaInicio: data!.fechaInicio,
      fechaFin: data!.fechaFin,
      usuario: data!.usuario,
      pasos: data!.pasos,
      interacciones: data!.interacciones,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeNombre = data!.nombreActividad.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.download = `resumen-${safeNombre}-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (data.estado === 'finalizado') {
    return (
      <>
        <RunnerHeader nombreActividad={data.nombreActividad} nombreEmpresa={data.nombreEmpresa} logoEmpresa={data.logoEmpresa} />
        <div className="runner-layout" style={{ paddingTop: 88 }}>
          <div className="card runner-card" style={{ textAlign: 'center', padding: '3rem 2.25rem' }}>
            <ActivityBranding
              nombreActividad={data.nombreActividad}
              nombreEmpresa={data.nombreEmpresa}
              logoEmpresa={data.logoEmpresa}
              border
            />
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', fontSize: '1.75rem',
            }}>✓</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>¡Actividad completada!</h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32, maxWidth: 380, margin: '0 auto 32px' }}>
              Sus respuestas han sido registradas exitosamente. Puede ver un resumen completo a continuación.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={`/runner/${token}/resultados`} className="btn btn-primary"
                style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem', textDecoration: 'none', display: 'inline-flex' }}>
                Ver mis resultados →
              </a>
              <button onClick={handleDescargarResumen} className="btn btn-secondary"
                style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem' }}>
                Descargar resumen HTML
              </button>
            </div>
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

  // Cuando el paso es iaAutomatica + archivo, la IA va primero (genera → descarga → sube)
  const iaFirst = !!(currentPaso.iaAutomatica && (currentPaso.soloArchivo || currentPaso.permitirArchivo));
  const showRespuesta = !currentPaso.iaAutomatica || currentPaso.permitirArchivo || currentPaso.soloArchivo;

  // Numeración dinámica de secciones
  let secNum = 0;
  const instrSecNum = currentPaso.instrucciones ? ++secNum : null;
  let iaSecNum: number | null = null;
  let respSecNum: number | null = null;
  if (iaFirst) {
    iaSecNum = currentPaso.usarIa ? ++secNum : null;
    respSecNum = showRespuesta ? ++secNum : null;
  } else {
    respSecNum = showRespuesta ? ++secNum : null;
    iaSecNum = currentPaso.usarIa ? ++secNum : null;
  }

  return (
    <>
      <RunnerHeader nombreActividad={data.nombreActividad} nombreEmpresa={data.nombreEmpresa} logoEmpresa={data.logoEmpresa} />

      {/* Progress bar */}
      <div className="runner-progress-bar" style={{ top: 52 }}>
        <div className="runner-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="runner-layout" style={{ paddingTop: 88 }}>
        <div className="runner-card card">

          {/* Company branding */}
          <ActivityBranding
            nombreActividad={data.nombreActividad}
            nombreEmpresa={data.nombreEmpresa}
            logoEmpresa={data.logoEmpresa}
            border
          />

          {/* Respuestas de la plantilla anterior (desplegable) */}
          {data.plantillaAnterior && data.plantillaAnterior.respuestas.length > 0 && (
            <div style={{ marginBottom: 20, border: '1px solid #C7D2FE', borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setPlantillaAnteriorExpanded(e => !e)}
                style={{
                  width: '100%', background: '#EEF2FF', border: 'none',
                  padding: '11px 16px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderRadius: plantillaAnteriorExpanded ? '10px 10px 0 0' : 10,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#3730A3' }}>
                  📋 Respuestas de "{data.plantillaAnterior.nombre}"
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6366F1', flexShrink: 0 }}>
                  {plantillaAnteriorExpanded ? '▲ Cerrar' : '▼ Ver respuestas anteriores'}
                </span>
              </button>
              {plantillaAnteriorExpanded && (
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.plantillaAnterior.respuestas.map((r, i) => {
                    const contenido = r.respuestaIa || r.respuestaUsuario || r.contenido || '';
                    return (
                      <div key={i} style={{
                        borderBottom: i < data.plantillaAnterior!.respuestas.length - 1 ? '1px solid #E0E7FF' : 'none',
                        paddingBottom: i < data.plantillaAnterior!.respuestas.length - 1 ? 14 : 0,
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366F1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Paso {r.pasoOrden}: {r.pasoTitulo}
                        </div>
                        {contenido ? (
                          <div style={{ fontSize: '0.875rem', color: '#1E293B', lineHeight: 1.65 }} className="markdown-anterior">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contenido}</ReactMarkdown>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin respuesta registrada</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
          <div style={{ marginBottom: currentPaso.objetivo ? 8 : 20 }}>
            <h2 style={{ fontSize: '1.375rem', margin: 0 }}>
              {currentPaso.titulo}
            </h2>
          </div>
          {currentPaso.objetivo && (
            <p style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontStyle: 'italic', marginBottom: 24, fontWeight: 500 }}>
              {currentPaso.objetivo}
            </p>
          )}

          {/* SECCIÓN: Instrucciones */}
          {currentPaso.instrucciones && instrSecNum !== null && (
            <SectionBlock
              number={instrSecNum}
              title="Instrucciones"
              description="Lee atentamente antes de comenzar tu respuesta"
              color="violet"
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#4C1D95', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {currentPaso.instrucciones}
              </p>
            </SectionBlock>
          )}

          {/* SECCIÓN: Tu respuesta + Asistente IA — orden invertido cuando iaFirst */}
          <div style={iaFirst ? { display: 'flex', flexDirection: 'column' } : undefined}>

          {showRespuesta && <div style={iaFirst ? { order: 2 } : undefined}><SectionBlock
            number={respSecNum!}
            title="Tu respuesta"
            description={
              (currentPaso.permitirArchivo || currentPaso.soloArchivo)
                ? 'Sube el documento completado para avanzar al siguiente paso.'
                : currentPaso.usarIa
                  ? 'Escribe tu respuesta inicial. Luego podrás enriquecerla con el Asistente IA antes de guardar.'
                  : 'Escribe aquí tu análisis o respuesta para avanzar al siguiente paso.'
            }
            color="blue"
          >
            {/* Respuesta del paso anterior — solo en pasos sin IA automática */}
            {respuestaAnterior && !currentPaso.iaAutomatica && (
              <div style={{
                marginBottom: 14, padding: '0.75rem 1rem',
                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#B45309', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Respuesta del paso anterior
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400E', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {respuestaAnterior}
                  </p>
                </div>
                {!currentPaso.permitirArchivo && !currentPaso.soloArchivo && (
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem', flexShrink: 0, alignSelf: 'center' }}
                    onClick={() => editorRef.current?.insertContent(respuestaAnterior)}>
                    Usar en respuesta
                  </button>
                )}
              </div>
            )}

            {!currentPaso.permitirArchivo && !currentPaso.soloArchivo && (
              <WysiwygEditor
                ref={editorRef}
                value={respuesta}
                onChange={setRespuesta}
                placeholder="Escriba aquí su respuesta..."
                minHeight={220}
              />
            )}

            {/* Plantilla descargable + subida de archivo (pasos con permitirArchivo o soloArchivo) */}
            {(currentPaso.permitirArchivo || currentPaso.soloArchivo) && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* PASO 1 — Descargar plantilla */}
                {currentPaso.urlPlantilla && (() => {
                  const selfIaRespondido = currentPaso.usarIa
                    ? data!.interacciones.some(i => i.pasoId === currentPaso.id)
                    : false;
                  const prevIaPaso = !currentPaso.usarIa
                    ? data!.pasos.slice(0, currentStepIndex).reverse().find(p => p.usarIa)
                    : null;
                  const prevIaRespondido = prevIaPaso
                    ? data!.interacciones.some(i => i.pasoId === prevIaPaso.id)
                    : false;
                  const iaRespondido = selfIaRespondido || prevIaRespondido;

                  return (
                    <div style={{
                      padding: '16px 20px',
                      background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: '#16A34A', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700,
                        }}>1</div>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#14532D' }}>
                          Descarga la plantilla de priorización
                        </span>
                      </div>
                      <p style={{ margin: '0 0 12px 34px', fontSize: '0.82rem', color: '#166534', lineHeight: 1.5 }}>
                        La plantilla ya viene pre-diligenciada con las ideas generadas por el asistente. Descárgala, completa los puntajes con tu equipo y guárdala.
                      </p>
                      <div style={{ marginLeft: 34 }}>
                        {currentPaso.iaAutomatica && !iaRespondido ? (
                          <span style={{ fontSize: '0.82rem', color: '#6D28D9', fontStyle: 'italic' }}>
                            {enviandoIa ? '⏳ Generando ideas con IA...' : '⏳ Disponible una vez que el asistente termine de generar las ideas'}
                          </span>
                        ) : iaRespondido ? (
                          <button
                            onClick={() => handleDescargarPlantillaPrediligenciada(currentPaso.id)}
                            disabled={descargandoExcel}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 8,
                              padding: '8px 18px', fontSize: '0.85rem',
                              background: descargandoExcel ? '#DCFCE7' : '#16A34A', color: descargandoExcel ? '#166534' : 'white',
                              borderRadius: 8, fontWeight: 600, border: 'none',
                              cursor: descargandoExcel ? 'wait' : 'pointer',
                              boxShadow: descargandoExcel ? 'none' : '0 1px 4px rgba(22,163,74,0.3)',
                            }}
                          >
                            {descargandoExcel ? '⏳ Generando...' : '⬇ Descargar plantilla pre-diligenciada'}
                          </button>
                        ) : (
                          <a
                            href={currentPaso.urlPlantilla}
                            download
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 8,
                              padding: '8px 18px', fontSize: '0.85rem',
                              background: '#16A34A', color: 'white',
                              borderRadius: 8, fontWeight: 600, border: 'none', textDecoration: 'none',
                              boxShadow: '0 1px 4px rgba(22,163,74,0.3)',
                            }}
                          >
                            ⬇ Descargar plantilla vacía
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* PASO 2 — Subir archivo diligenciado */}
                <div style={{
                  padding: '16px 20px',
                  background: archivoRespuesta ? '#EFF6FF' : '#F8FAFC',
                  border: `2px ${archivoRespuesta ? 'solid #93C5FD' : 'dashed #CBD5E1'}`,
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: archivoRespuesta ? '#2563EB' : '#94A3B8', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700,
                    }}>2</div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: archivoRespuesta ? '#1E3A8A' : '#475569' }}>
                      Sube el archivo completado
                    </span>
                  </div>
                  <p style={{ margin: '0 0 12px 34px', fontSize: '0.82rem', color: '#64748B', lineHeight: 1.5 }}>
                    Una vez que hayas completado la tabla de priorización, sube el archivo aquí para finalizar el taller.
                  </p>
                  <div style={{ marginLeft: 34, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '8px 18px', fontSize: '0.85rem',
                      background: archivoRespuesta ? '#DBEAFE' : 'white', color: archivoRespuesta ? '#1D4ED8' : '#475569',
                      borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      border: `1px solid ${archivoRespuesta ? '#93C5FD' : '#CBD5E1'}`,
                    }}>
                      {archivoRespuesta ? `✓ ${archivoRespuesta.name}` : '📂 Seleccionar archivo (.xlsx)'}
                      <input type="file" accept=".xlsx,.xls,.csv"
                        style={{ display: 'none' }}
                        onChange={e => setArchivoRespuesta(e.target.files?.[0] || null)} />
                    </label>
                    {archivoRespuesta && (
                      <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                        onClick={() => setArchivoRespuesta(null)}>✕ Quitar</button>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Adjuntar archivo (solo si hay IA no automática) */}
            {currentPaso.usarIa && !currentPaso.iaAutomatica && (
              <div style={{
                marginTop: 10, padding: '10px 14px',
                background: '#FAFAFE', border: '1px dashed #C4B5FD', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '0.8rem', color: '#6D28D9', fontWeight: 500 }}>Adjuntar archivo</span>
                <span style={{ fontSize: '0.73rem', color: 'var(--color-text-tertiary)' }}>PDF, Word, Excel — máx. 10 MB</span>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', fontSize: '0.78rem',
                  background: '#EDE9FE', color: '#5B21B6',
                  borderRadius: 6, cursor: 'pointer', fontWeight: 500, border: '1px solid #C4B5FD',
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
          </SectionBlock></div>}

          {/* SECCIÓN: Asistente IA */}
          {currentPaso.usarIa && iaSecNum !== null && (
            <div style={iaFirst ? { order: 1 } : undefined}><SectionBlock
              number={iaSecNum}
              title="Asistente IA"
              description={
                currentPaso.iaAutomatica
                  ? 'El asistente analiza automáticamente las respuestas anteriores y genera el resultado. Podrás editarlo antes de guardar.'
                  : 'Envía tu respuesta al asistente para recibir análisis y retroalimentación. Podrás editar el resultado antes de guardar.'
              }
              color="purple"
            >
              {/* Indicador de modo automático */}
              {currentPaso.iaAutomatica && (
                <div style={{
                  marginBottom: 14, padding: '8px 14px',
                  background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: '0.82rem', color: '#6D28D9', fontWeight: 500,
                }}>
                  <span>⚡</span>
                  <span>Generación automática activada — el asistente usa el contexto de los pasos anteriores.</span>
                </div>
              )}

              {/* Prompt personalizable (colapsable) */}
              {customPrompt && (
                <div style={{ marginBottom: 14 }}>
                  <button
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.78rem', color: '#7C3AED', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                      marginBottom: showPromptEdit ? 8 : 0,
                    }}
                    onClick={() => setShowPromptEdit(p => !p)}
                  >
                    <span style={{ fontSize: '0.7rem' }}>{showPromptEdit ? '▲' : '▼'}</span>
                    {showPromptEdit ? 'Ocultar instrucciones al asistente' : 'Personalizar instrucciones al asistente'}
                  </button>
                  {showPromptEdit && (
                    <>
                      <textarea
                        className="input"
                        rows={6}
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, resize: 'vertical' }}
                      />
                      <p style={{ margin: '4px 0 0', fontSize: '0.73rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                        Ajusta estas instrucciones para que el asistente se enfoque en lo que necesitas.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Botón enviar */}
              <button
                className="btn btn-primary"
                style={{
                  background: '#7C3AED', boxShadow: '0 1px 2px rgba(109,40,217,0.3)',
                  marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
                }}
                onClick={handleEnviarIA}
                disabled={(!currentPaso.iaAutomatica && !respuesta.trim() && !archivoIa) || enviandoIa}
              >
                {enviandoIa ? (
                  <>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Consultando...
                  </>
                ) : currentPaso.iaAutomatica ? '↺ Volver a consultar' : '✨ Enviar a Asistente IA'}
              </button>

              {/* Respuesta IA */}
              {(respuestaIa || enviandoIa) ? (
                <>
                  {enviandoIa && !respuestaIa && (
                    <div style={{
                      padding: '1.5rem', textAlign: 'center', color: '#7C3AED',
                      fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      background: '#FAF8FF', borderRadius: 8, marginBottom: 10,
                    }}>
                      <span style={{ width: 16, height: 16, border: '2px solid #DDD6FE', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      Generando análisis con IA...
                    </div>
                  )}
                  <WysiwygEditor
                    ref={iaEditorRef}
                    value={respuestaIa}
                    onChange={setRespuestaIa}
                    placeholder="La respuesta del asistente aparecerá aquí. Podrás editarla antes de guardar."
                    minHeight={180}
                    borderColor="#DDD6FE"
                  />
                </>
              ) : (
                <div style={{
                  padding: '1.25rem', borderRadius: 8, background: '#FAF8FF',
                  border: '1px dashed #DDD6FE', textAlign: 'center',
                  color: '#7C3AED', fontSize: '0.85rem',
                }}>
                  {currentPaso.iaAutomatica
                    ? 'El asistente generará el análisis automáticamente al ingresar al paso.'
                    : <>Aún no has consultado al asistente. Escribe tu respuesta arriba y presiona <strong>Enviar a Asistente IA</strong>.</>}
                </div>
              )}
            </SectionBlock></div>
          )}

          </div>{/* end iaFirst flex wrapper */}

          {/* Botones anterior / siguiente */}
          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            {currentStepIndex > 0 ? (
              <button
                className="btn btn-secondary"
                onClick={handleAnterior}
                disabled={loading}
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.9375rem' }}
              >
                ← Paso anterior
              </button>
            ) : <div />}
            <button
              className="btn btn-primary"
              onClick={handleSiguiente}
              disabled={((currentPaso.soloArchivo || currentPaso.permitirArchivo) ? !archivoRespuesta : currentPaso.usarIa ? !respuestaIa.trim() : !respuesta.trim()) || loading || (currentPaso.iaAutomatica ? enviandoIa : false)}
              style={{ padding: '0.625rem 1.5rem', fontSize: '0.9375rem' }}
            >
              {loading ? 'Guardando...' : isLastStep ? 'Finalizar actividad' : 'Siguiente paso →'}
            </button>
          </div>

        </div>
      </div>

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .markdown-anterior p { margin: 0 0 6px; }
        .markdown-anterior p:last-child { margin-bottom: 0; }
        .markdown-anterior table { border-collapse: collapse; width: 100%; font-size: 0.82rem; margin: 6px 0; }
        .markdown-anterior th { background: #EEF2FF; color: #3730A3; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid #C7D2FE; }
        .markdown-anterior td { padding: 5px 10px; border: 1px solid #E0E7FF; vertical-align: top; }
        .markdown-anterior tr:nth-child(even) td { background: #F5F7FF; }
        .markdown-anterior ul, .markdown-anterior ol { margin: 4px 0; padding-left: 18px; }
        .markdown-anterior li { margin-bottom: 2px; }
        .markdown-anterior strong { font-weight: 600; }
      `}</style>
    </>
  );
}
