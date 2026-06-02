import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WysiwygEditor, WysiwygEditorHandle } from '../../components/WysiwygEditor';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Toast } from '../../components/Toast';
import { buildResumenHtml } from './buildResumenHtml';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Pregunta {
  id: string;
  orden: number;
  enunciado: string;
  permitirArchivo: boolean;
  soloArchivo: boolean;
  usarIa: boolean;
  iaAutomatica: boolean;
  promptIa?: string;
  urlPlantilla?: string;
  urlPromptTemplate?: string;
  /** Texto del prompt ya resuelto por el backend cuando urlPromptTemplate apunta a S3. */
  promptIaInline?: string;
}

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
  ejemploKey?: string;
  preguntas: Pregunta[];
}

interface RespuestaAnterior {
  pasoTitulo: string;
  pasoOrden: number;
  contenido?: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
  contenidoArchivo?: string;
}

interface RespuestaPorPregunta {
  contenido?: string;
  respuestaUsuario?: string;
  respuestaIa?: string;
  archivoNombre?: string;
  contenidoArchivo?: string;
}

interface RunnerData {
  estado: string;
  nombreActividad: string;
  descripcionActividad?: string;
  nombreEmpresa?: string;
  sectorEmpresa?: string;
  tipoOrganizacionEmpresa?: string;
  logoEmpresa?: string;
  usuarioId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  usuario?: { nombre: string; email: string; cargo?: string | null; area?: string | null };
  pasos: Paso[];
  interacciones: { pasoId: string; contenido: string; respuestaUsuario?: string; respuestaIa?: string; archivoNombre?: string; contenidoArchivo?: string }[];
  respuestas: { preguntaId: string; contenido?: string; respuestaUsuario?: string; respuestaIa?: string; archivoNombre?: string; contenidoArchivo?: string; archivoKey?: string }[];
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

// TODO(IA-por-pregunta): revisar al implementar — la interpolación debe soportar referencias
// por pregunta (p.ej. {{paso_2.pregunta_1}}) además del agregado actual por paso.
interface PromptCtx {
  empresa?: { nombre?: string; sector?: string; tipoOrganizacion?: string };
  usuario?: { area?: string; cargo?: string };
}

function interpolarPrompt(
  prompt: string,
  pasos: Paso[],
  respuestas: RunnerData['respuestas'],
  ctx?: PromptCtx
): string {
  let result = prompt;

  result = result
    .replace(/\{\{empresa\.nombre\}\}/g, ctx?.empresa?.nombre || '[nombre de organización no disponible]')
    .replace(/\{\{empresa\.sector\}\}/g, ctx?.empresa?.sector || '[sector no disponible]')
    .replace(/\{\{empresa\.tipoOrganizacion\}\}/g, ctx?.empresa?.tipoOrganizacion || '[tipo de organización no disponible]')
    .replace(/\{\{idenForm\.area\}\}/g, ctx?.usuario?.area || '[área no disponible]')
    .replace(/\{\{idenForm\.cargo\}\}/g, ctx?.usuario?.cargo || '[cargo no disponible]');

  if (!result.includes('{{paso_')) return result;

  return result.replace(/\{\{paso_(\d+)\}\}/g, (_match, nStr) => {
    const n = parseInt(nStr, 10);
    const paso = pasos[n - 1];
    if (!paso) return `[paso ${n} no encontrado]`;
    const textos: string[] = [];
    for (const pregunta of (paso.preguntas ?? [])) {
      const r = respuestas.find(r => r.preguntaId === pregunta.id);
      const texto = r?.contenido || r?.respuestaUsuario || r?.contenidoArchivo || '';
      if (texto.trim()) textos.push(stripHtmlToText(texto));
    }
    return textos.length > 0 ? textos.join('\n\n') : '[sin respuesta]';
  });
}

export function RunnerPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RunnerData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Per-pregunta state maps (keyed by preguntaId)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [respuestasIa, setRespuestasIa] = useState<Record<string, string>>({});
  const [archivosRespuesta, setArchivosRespuesta] = useState<Record<string, File | null>>({});
  const [archivosIa, setArchivosIa] = useState<Record<string, File | null>>({});
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [enviandoIa, setEnviandoIa] = useState<Record<string, boolean>>({});

  const [idenForm, setIdenForm] = useState({ nombre: '', email: '', cargo: '', area: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'info' } | null>(null);
  const [plantillaAnteriorExpanded, setPlantillaAnteriorExpanded] = useState(false);

  // Refs por preguntaId
  const editorRefs = useRef<Record<string, WysiwygEditorHandle | null>>({});
  const iaEditorRefs = useRef<Record<string, WysiwygEditorHandle | null>>({});
  const autoIaRunRef = useRef<Set<string>>(new Set());
  const rawTemplatesRef = useRef<Record<string, string>>({});
  const autoIniciarFiredRef = useRef(false);

  async function prefetchTemplates(pasos: Paso[]): Promise<void> {
    const fetches: Promise<void>[] = [];
    for (const paso of pasos) {
      for (const q of (paso.preguntas ?? [])) {
        if (rawTemplatesRef.current[q.id]) continue;
        // Si el backend ya resolvió el prompt (S3), lo usamos directo sin fetch.
        if (q.promptIaInline) {
          rawTemplatesRef.current[q.id] = q.promptIaInline;
          continue;
        }
        // Fallback: path local (/templates/...) — fetch directo.
        if (q.urlPromptTemplate && q.urlPromptTemplate.startsWith('/')) {
          fetches.push(
            fetch(q.urlPromptTemplate)
              .then(r => r.text())
              .then(text => { rawTemplatesRef.current[q.id] = text; })
              .catch(() => {})
          );
        }
      }
    }
    await Promise.all(fetches);
  }

  function getBasePrompt(q: Pregunta): string | null {
    if (rawTemplatesRef.current[q.id]) {
      return rawTemplatesRef.current[q.id];
    }
    return q.promptIa ?? null;
  }

  const loadData = async () => {
    try {
      const res = await fetch(`${API_URL}/execution/${token}`);
      if (!res.ok) throw new Error('No se pudo cargar la actividad');
      const json = await res.json();
      await prefetchTemplates(json.pasos);
      setData(json);

      // Populate per-pregunta state from saved respuestas
      const rMap: Record<string, string> = {};
      const rIaMap: Record<string, string> = {};
      const promptsMap: Record<string, string> = {};
      for (const r of (json.respuestas ?? [])) {
        if (r.respuestaIa) {
          rIaMap[r.preguntaId] = r.respuestaIa;
          rMap[r.preguntaId] = r.respuestaUsuario || '';
        } else {
          rMap[r.preguntaId] = r.contenido || '';
        }
      }
      setRespuestas(rMap);
      setRespuestasIa(rIaMap);

      // Determine which step to show
      const pasoRespondido = (p: Paso) =>
        p.preguntas.length > 0
          ? p.preguntas.every(q => (json.respuestas ?? []).some((r: any) => r.preguntaId === q.id))
          : (json.interacciones ?? []).some((i: any) => i.pasoId === p.id);

      if (json.estado !== 'generado') {
        const lastAnsweredIndex = json.pasos.findIndex((p: Paso) => !pasoRespondido(p));
        if (lastAnsweredIndex !== -1) {
          setCurrentStepIndex(lastAnsweredIndex);
          // Interpolate prompts for first unanswered step
          const paso = json.pasos[lastAnsweredIndex];
          for (const q of (paso.preguntas ?? [])) {
            const base = getBasePrompt(q);
            if (base) promptsMap[q.id] = interpolarPrompt(base, json.pasos, json.respuestas ?? [], { empresa: { nombre: json.nombreEmpresa, sector: json.sectorEmpresa, tipoOrganizacion: json.tipoOrganizacionEmpresa } });
          }
        } else if (json.estado === 'finalizado') {
          setCurrentStepIndex(json.pasos.length);
        } else {
          const lastIdx = json.pasos.length - 1;
          setCurrentStepIndex(lastIdx);
          const paso = json.pasos[lastIdx];
          for (const q of (paso?.preguntas ?? [])) {
            const base = getBasePrompt(q);
            if (base) promptsMap[q.id] = interpolarPrompt(base, json.pasos, json.respuestas ?? [], { empresa: { nombre: json.nombreEmpresa, sector: json.sectorEmpresa, tipoOrganizacion: json.tipoOrganizacionEmpresa } });
          }
        }
      } else if (json.pasos.length > 0) {
        const paso = json.pasos[0];
        for (const q of (paso.preguntas ?? [])) {
          const base = getBasePrompt(q);
          if (base) promptsMap[q.id] = interpolarPrompt(base, json.pasos, json.respuestas ?? [], { empresa: { nombre: json.nombreEmpresa, sector: json.sectorEmpresa, tipoOrganizacion: json.tipoOrganizacionEmpresa } });
        }
      }
      setCustomPrompts(promptsMap);
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
    if (!paso) return;

    for (const pregunta of (paso.preguntas ?? [])) {
      if (!pregunta.usarIa || !pregunta.iaAutomatica) continue;
      if (autoIaRunRef.current.has(pregunta.id)) continue;
      const yaRespondida = data.respuestas.find(r => r.preguntaId === pregunta.id);
      if (yaRespondida?.respuestaIa) {
        setRespuestasIa(prev => ({ ...prev, [pregunta.id]: yaRespondida.respuestaIa! }));
        iaEditorRefs.current[pregunta.id]?.replaceContent(yaRespondida.respuestaIa!);
        continue;
      }
      autoIaRunRef.current.add(pregunta.id);
      const runAutoIa = async (q: Pregunta) => {
        setEnviandoIa(prev => ({ ...prev, [q.id]: true }));
        setRespuestasIa(prev => ({ ...prev, [q.id]: '' }));
        iaEditorRefs.current[q.id]?.replaceContent('');
        try {
          const base = getBasePrompt(q) ?? '';
          const interpolado = interpolarPrompt(base, data.pasos, data.respuestas, { empresa: { nombre: data.nombreEmpresa, sector: data.sectorEmpresa, tipoOrganizacion: data.tipoOrganizacionEmpresa }, usuario: { area: idenForm.area, cargo: idenForm.cargo } });
          const formData = new FormData();
          formData.append('pasoId', paso.id);
          // TODO(IA-por-pregunta): revisar al implementar — enviar preguntaId en lugar de (o además de) pasoId.
          formData.append('respuesta', '');
          if (interpolado) formData.append('customPrompt', interpolado);
          const res = await fetch(`${API_URL}/execution/${token}/ia`, { method: 'POST', body: formData });
          if (!res.ok) throw new Error();
          const json = await res.json();
          setRespuestasIa(prev => ({ ...prev, [q.id]: json.respuestaIa }));
          iaEditorRefs.current[q.id]?.replaceContent(json.respuestaIa);

          // Auto-save when question also requires file upload (for Excel prefill endpoint)
          if (q.soloArchivo || q.permitirArchivo) {
            await fetch(`${API_URL}/execution/${token}/responder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pasoId: paso.id, preguntaId: q.id, contenido: json.respuestaIa, respuestaIa: json.respuestaIa }),
            });
            setData(prev => prev ? {
              ...prev,
              respuestas: [
                ...prev.respuestas.filter(r => r.preguntaId !== q.id),
                { preguntaId: q.id, contenido: json.respuestaIa, respuestaIa: json.respuestaIa },
              ],
            } : prev);
          }
        } catch {
          autoIaRunRef.current.delete(q.id);
        } finally {
          setEnviandoIa(prev => ({ ...prev, [q.id]: false }));
        }
      };
      runAutoIa(pregunta);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, data?.estado]);

  const handleIniciar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/execution/${token}/iniciar`, { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Algo salió mal al iniciar la actividad');
      }
      await loadData();
    } catch (err: any) {
      alert('Algo salió mal al iniciar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-iniciar la actividad cuando el participante ya está identificado y la instancia
  // todavía no se ha arrancado: salta el splash de "Comenzar actividad".
  useEffect(() => {
    if (
      data?.estado === 'generado' &&
      data?.usuarioId &&
      !autoIniciarFiredRef.current
    ) {
      autoIniciarFiredRef.current = true;
      handleIniciar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.estado, data?.usuarioId]);

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

  const handleDescargarPlantillaPrediligenciada = async (pasoId: string, preguntaId: string) => {
    setDescargandoExcel(true);
    try {
      const res = await fetch(`${API_URL}/execution/${token}/plantilla-prefilled/${pasoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestaIa: respuestasIa[preguntaId] || undefined }),
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

    // Validate all questions answered
    for (const q of (paso.preguntas ?? [])) {
      const tieneTexto = (q.usarIa ? respuestasIa[q.id] : respuestas[q.id])?.trim();
      const tieneArchivo = !!archivosRespuesta[q.id];
      if (!tieneTexto && !tieneArchivo) {
        if (q.usarIa && !respuestasIa[q.id]?.trim()) {
          return alert(`Consultá al asistente para la pregunta "${q.enunciado.slice(0, 60)}..." antes de continuar.`);
        }
        if (q.soloArchivo || q.permitirArchivo) {
          return alert(`Adjuntá el archivo requerido para continuar.`);
        }
        return alert(`Respondé todas las preguntas antes de continuar.`);
      }
    }

    setLoading(true);

    // Save each question's answer
    const newRespuestas = [...data!.respuestas];
    for (const q of (paso.preguntas ?? [])) {
      const textoRespuesta = q.usarIa ? respuestasIa[q.id] : respuestas[q.id];
      const archivo = archivosRespuesta[q.id];
      let responderRes: Response;
      if (archivo) {
        const formData = new FormData();
        formData.append('pasoId', paso.id);
        formData.append('preguntaId', q.id);
        formData.append('contenido', textoRespuesta ?? '');
        formData.append('archivo', archivo);
        responderRes = await fetch(`${API_URL}/execution/${token}/responder`, { method: 'POST', body: formData });
      } else {
        responderRes = await fetch(`${API_URL}/execution/${token}/responder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pasoId: paso.id,
            preguntaId: q.id,
            contenido: textoRespuesta ?? '',
            respuestaUsuario: q.usarIa ? (respuestas[q.id] ?? undefined) : undefined,
            respuestaIa: q.usarIa ? (respuestasIa[q.id] ?? undefined) : undefined,
          })
        });
      }
      if (!responderRes.ok) {
        setLoading(false);
        return alert('Error al guardar la respuesta. Por favor intentá de nuevo.');
      }
      const entry = { preguntaId: q.id, contenido: textoRespuesta, respuestaUsuario: q.usarIa ? respuestas[q.id] : undefined, respuestaIa: q.usarIa ? respuestasIa[q.id] : undefined, archivoNombre: archivo?.name };
      const idx = newRespuestas.findIndex(r => r.preguntaId === q.id);
      if (idx >= 0) newRespuestas[idx] = entry; else newRespuestas.push(entry);
    }

    setData(prev => prev ? { ...prev, respuestas: newRespuestas } : prev);

    if (currentStepIndex < data!.pasos.length - 1) {
      const sig = data!.pasos[currentStepIndex + 1];

      // Build prompts for next step
      const promptsMap: Record<string, string> = { ...customPrompts };
      for (const q of (sig.preguntas ?? [])) {
        const base = getBasePrompt(q);
        if (base) promptsMap[q.id] = interpolarPrompt(base, data!.pasos, newRespuestas, { empresa: { nombre: data!.nombreEmpresa, sector: data!.sectorEmpresa, tipoOrganizacion: data!.tipoOrganizacionEmpresa }, usuario: { area: idenForm.area, cargo: idenForm.cargo } });
      }
      setCustomPrompts(promptsMap);

      setCurrentStepIndex(currentStepIndex + 1);
      setArchivosRespuesta({});
      setArchivosIa({});
    } else {
      await fetch(`${API_URL}/execution/${token}/finalizar`, { method: 'POST' });
      await loadData();
    }
    setLoading(false);
  };

  // TODO(IA-por-pregunta): revisar al implementar — enviar preguntaId junto a pasoId para que
  // el backend lea usarIa/promptIa de PreguntaActividad en lugar de PasoActividad.
  const handleEnviarIA = async (paso: Paso, pregunta: Pregunta) => {
    if (!pregunta.iaAutomatica && !respuestas[pregunta.id]?.trim() && !archivosIa[pregunta.id]) {
      return alert('Escribí tu respuesta o adjuntá un archivo para consultar al asistente.');
    }
    setEnviandoIa(prev => ({ ...prev, [pregunta.id]: true }));
    setRespuestasIa(prev => ({ ...prev, [pregunta.id]: '' }));
    iaEditorRefs.current[pregunta.id]?.replaceContent('');

    try {
      const formData = new FormData();
      formData.append('pasoId', paso.id);
      formData.append('respuesta', respuestas[pregunta.id] ?? '');
      const prompt = customPrompts[pregunta.id] ?? '';
      if (prompt) formData.append('customPrompt', prompt);
      const archivoIa = archivosIa[pregunta.id];
      if (archivoIa) formData.append('archivo', archivoIa);

      const res = await fetch(`${API_URL}/execution/${token}/ia`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Error al consultar la IA');

      const json = await res.json();
      setRespuestasIa(prev => ({ ...prev, [pregunta.id]: json.respuestaIa }));
      iaEditorRefs.current[pregunta.id]?.replaceContent(json.respuestaIa);
    } catch {
      alert('No pudimos conectar con el asistente. Intentá de nuevo.');
    } finally {
      setEnviandoIa(prev => ({ ...prev, [pregunta.id]: false }));
    }
  };

  const handleAnterior = async () => {
    if (currentStepIndex === 0) return;
    const pasoActual = data!.pasos[currentStepIndex];

    setLoading(true);

    // Auto-save any partial answers before going back
    const newRespuestas = [...data!.respuestas];
    for (const q of (pasoActual.preguntas ?? [])) {
      const texto = q.usarIa ? respuestasIa[q.id] : respuestas[q.id];
      if (!texto?.trim() && !archivosRespuesta[q.id]) continue;
      await fetch(`${API_URL}/execution/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pasoId: pasoActual.id,
          preguntaId: q.id,
          contenido: texto ?? '',
          respuestaUsuario: q.usarIa ? (respuestas[q.id] ?? undefined) : undefined,
          respuestaIa: q.usarIa ? (respuestasIa[q.id] ?? undefined) : undefined,
        })
      });
      const entry = { preguntaId: q.id, contenido: texto, respuestaUsuario: q.usarIa ? respuestas[q.id] : undefined, respuestaIa: q.usarIa ? respuestasIa[q.id] : undefined };
      const idx = newRespuestas.findIndex(r => r.preguntaId === q.id);
      if (idx >= 0) newRespuestas[idx] = entry; else newRespuestas.push(entry);
    }
    setData(prev => prev ? { ...prev, respuestas: newRespuestas } : prev);

    const nuevoIndex = currentStepIndex - 1;
    setCurrentStepIndex(nuevoIndex);
    setArchivosRespuesta({});
    setArchivosIa({});
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

            {!data.usuarioId ? (
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
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Iniciando actividad...
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
      respuestas: data!.respuestas,
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
  const isLastStep = currentStepIndex === data.pasos.length - 1;

  const anyEnviando = currentPaso.preguntas.some(q => !!enviandoIa[q.id]);

  // "Siguiente" habilitado when every question has an answer
  const pasoCompleto = currentPaso.preguntas.every(q => {
    if (q.soloArchivo || q.permitirArchivo) return !!archivosRespuesta[q.id];
    if (q.usarIa) return !!respuestasIa[q.id]?.trim();
    return !!respuestas[q.id]?.trim();
  });

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
                    const contenido = r.contenidoArchivo || r.respuestaUsuario || r.respuestaIa || r.contenido || '';
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
            <h2 style={{ fontSize: '1.375rem', margin: 0 }}>{currentPaso.titulo}</h2>
          </div>
          {currentPaso.objetivo && (
            <p style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontStyle: 'italic', marginBottom: 24, fontWeight: 500 }}>
              {currentPaso.objetivo}
            </p>
          )}

          {/* SECCIÓN: Instrucciones (+ archivo de ejemplo si hay) */}
          {(currentPaso.instrucciones || currentPaso.ejemploKey) && (
            <SectionBlock number={1} title="Instrucciones" description="Lee atentamente antes de comenzar" color="violet">
              {currentPaso.instrucciones && (
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#4C1D95', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {currentPaso.instrucciones}
                </p>
              )}
              {currentPaso.ejemploKey && (
                <div style={{
                  marginTop: currentPaso.instrucciones ? 14 : 0,
                  padding: '10px 14px',
                  background: '#F0FDF4',
                  border: '1px solid #86EFAC',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#14532D' }}>📎 Archivo de ejemplo</span>
                  <span style={{ fontSize: '0.78rem', color: '#166534', flex: 1, minWidth: 160 }}>
                    Material de referencia para este paso.
                  </span>
                  <button
                    className="btn"
                    style={{ padding: '5px 14px', fontSize: '0.82rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_URL}/execution/${token}/pasos/${currentPaso.id}/ejemplo-url`);
                        const json = await res.json();
                        if (json.url) window.open(json.url, '_blank');
                      } catch { alert('No se pudo obtener el enlace de descarga'); }
                    }}
                  >
                    ⬇ Descargar ejemplo
                  </button>
                </div>
              )}
            </SectionBlock>
          )}

          {/* PREGUNTAS — one card per pregunta pairing question + answer */}
          {currentPaso.preguntas.map((pregunta, qIdx) => {
            const iaFirst = !!(pregunta.iaAutomatica && (pregunta.soloArchivo || pregunta.permitirArchivo));
            const showRespuesta = !pregunta.iaAutomatica || pregunta.permitirArchivo || pregunta.soloArchivo;
            const archivoResp = archivosRespuesta[pregunta.id];
            const archivoIa = archivosIa[pregunta.id];

            return (
              <div key={pregunta.id} style={{
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 16,
              }}>
                {/* Pregunta header */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 20px',
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: '#0F172A', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, marginTop: 2,
                  }}>{qIdx + 1}</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#1E293B', lineHeight: 1.6, fontWeight: 500 }}>
                    {pregunta.enunciado}
                  </p>
                </div>

                {/* Respuesta body */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={iaFirst ? { display: 'flex', flexDirection: 'column' } : undefined}>

                  {/* Tu respuesta */}
                  {showRespuesta && (
                    <div style={iaFirst ? { order: 2 } : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, color: '#1D4ED8',
                          background: '#EFF6FF', border: '1px solid #BFDBFE',
                          padding: '2px 8px', borderRadius: 4, letterSpacing: '0.02em',
                        }}>Tu respuesta</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {(pregunta.permitirArchivo || pregunta.soloArchivo)
                            ? 'Sube el documento completado para avanzar al siguiente paso.'
                            : pregunta.usarIa
                              ? 'Escribe tu respuesta inicial. Luego podrás enriquecerla con el Asistente IA.'
                              : 'Escribe aquí tu análisis o respuesta.'}
                        </span>
                      </div>

                      {!pregunta.permitirArchivo && !pregunta.soloArchivo && (
                        <WysiwygEditor
                          ref={el => { editorRefs.current[pregunta.id] = el; }}
                          value={respuestas[pregunta.id] ?? ''}
                          onChange={v => setRespuestas(prev => ({ ...prev, [pregunta.id]: v }))}
                          placeholder="Escriba aquí su respuesta..."
                          minHeight={180}
                        />
                      )}

                      {/* Plantilla + archivo upload */}
                      {(pregunta.permitirArchivo || pregunta.soloArchivo) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                          {pregunta.urlPlantilla && (() => {
                            const iaRespondida = !!data.respuestas.find(r => r.preguntaId === pregunta.id)?.respuestaIa;
                            const estaGenerando = !!enviandoIa[pregunta.id];
                            return (
                              <div style={{ padding: '16px 20px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: '#16A34A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</div>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#14532D' }}>Descarga la plantilla de priorización</span>
                                </div>
                                <p style={{ margin: '0 0 12px 34px', fontSize: '0.82rem', color: '#166534', lineHeight: 1.5 }}>
                                  La plantilla ya viene pre-diligenciada con las ideas generadas por el asistente. Descárgala, completa los puntajes con tu equipo y guárdala.
                                </p>
                                <div style={{ marginLeft: 34 }}>
                                  {pregunta.iaAutomatica && !iaRespondida ? (
                                    <span style={{ fontSize: '0.82rem', color: '#6D28D9', fontStyle: 'italic' }}>
                                      {estaGenerando ? '⏳ Generando ideas con IA...' : '⏳ Disponible una vez que el asistente termine de generar las ideas'}
                                    </span>
                                  ) : iaRespondida ? (
                                    <button
                                      onClick={() => handleDescargarPlantillaPrediligenciada(currentPaso.id, pregunta.id)}
                                      disabled={descargandoExcel}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        padding: '8px 18px', fontSize: '0.85rem',
                                        background: descargandoExcel ? '#DCFCE7' : '#16A34A', color: descargandoExcel ? '#166534' : 'white',
                                        borderRadius: 8, fontWeight: 600, border: 'none', cursor: descargandoExcel ? 'wait' : 'pointer',
                                        boxShadow: descargandoExcel ? 'none' : '0 1px 4px rgba(22,163,74,0.3)',
                                      }}
                                    >
                                      {descargandoExcel ? '⏳ Generando...' : '⬇ Descargar plantilla pre-diligenciada'}
                                    </button>
                                  ) : (
                                    <a href={pregunta.urlPlantilla} download style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 8,
                                      padding: '8px 18px', fontSize: '0.85rem',
                                      background: '#16A34A', color: 'white',
                                      borderRadius: 8, fontWeight: 600, border: 'none', textDecoration: 'none',
                                      boxShadow: '0 1px 4px rgba(22,163,74,0.3)',
                                    }}>⬇ Descargar plantilla vacía</a>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Subir archivo */}
                          <div style={{
                            padding: '16px 20px',
                            background: archivoResp ? '#EFF6FF' : '#F8FAFC',
                            border: `2px ${archivoResp ? 'solid #93C5FD' : 'dashed #CBD5E1'}`,
                            borderRadius: 10,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: archivoResp ? '#2563EB' : '#94A3B8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                {pregunta.urlPlantilla ? '2' : '1'}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: archivoResp ? '#1E3A8A' : '#475569' }}>Sube el archivo completado</span>
                            </div>
                            <div style={{ marginLeft: 34, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '8px 18px', fontSize: '0.85rem',
                                background: archivoResp ? '#DBEAFE' : 'white', color: archivoResp ? '#1D4ED8' : '#475569',
                                borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                                border: `1px solid ${archivoResp ? '#93C5FD' : '#CBD5E1'}`,
                              }}>
                                {archivoResp ? `✓ ${archivoResp.name}` : '📂 Seleccionar archivo (.xlsx)'}
                                <input type="file" accept=".xlsx,.xls,.csv"
                                  style={{ display: 'none' }}
                                  onChange={e => setArchivosRespuesta(prev => ({ ...prev, [pregunta.id]: e.target.files?.[0] || null }))} />
                              </label>
                              {archivoResp && (
                                <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                                  onClick={() => setArchivosRespuesta(prev => ({ ...prev, [pregunta.id]: null }))}>✕ Quitar</button>
                              )}
                            </div>
                            {/* Download link for previously uploaded S3 file */}
                            {(() => {
                              const prev = data.respuestas.find(r => r.preguntaId === pregunta.id);
                              if (!prev?.archivoNombre || !prev?.archivoKey) return null;
                              return (
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>📎 Archivo enviado: <strong>{prev.archivoNombre}</strong></span>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`${API_URL}/execution/${token}/respuestas/${pregunta.id}/archivo-url`);
                                        const json = await res.json();
                                        if (json.url) window.open(json.url, '_blank');
                                      } catch { alert('No se pudo obtener el enlace de descarga'); }
                                    }}
                                  >
                                    ⬇ Descargar
                                  </button>
                                </div>
                              );
                            })()}
                          </div>

                        </div>
                      )}

                      {/* Adjuntar archivo para IA (solo si hay IA no automática) */}
                      {pregunta.usarIa && !pregunta.iaAutomatica && (
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
                              onChange={e => setArchivosIa(prev => ({ ...prev, [pregunta.id]: e.target.files?.[0] || null }))} />
                          </label>
                          {archivoIa && (
                            <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                              onClick={() => setArchivosIa(prev => ({ ...prev, [pregunta.id]: null }))}>✕ Quitar</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Asistente IA */}
                  {pregunta.usarIa && (
                    <div style={iaFirst ? { order: 1 } : { marginTop: 20, paddingTop: 20, borderTop: '1px solid #EDE9FE' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, color: '#7C3AED',
                          background: '#F5F3FF', border: '1px solid #DDD6FE',
                          padding: '2px 8px', borderRadius: 4, letterSpacing: '0.02em',
                        }}>Asistente IA</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {pregunta.iaAutomatica
                            ? 'El asistente analiza automáticamente las respuestas anteriores y genera el resultado. Podrás editarlo antes de guardar.'
                            : 'Envía tu respuesta al asistente para recibir análisis y retroalimentación.'}
                        </span>
                      </div>

                      {pregunta.iaAutomatica && (
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

                      <button
                        className="btn btn-primary"
                        style={{
                          background: '#7C3AED', boxShadow: '0 1px 2px rgba(109,40,217,0.3)',
                          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
                        }}
                        onClick={() => handleEnviarIA(currentPaso, pregunta)}
                        disabled={(!pregunta.iaAutomatica && !respuestas[pregunta.id]?.trim() && !archivosIa[pregunta.id]) || !!enviandoIa[pregunta.id]}
                      >
                        {enviandoIa[pregunta.id] ? (
                          <>
                            <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                            Consultando...
                          </>
                        ) : pregunta.iaAutomatica ? '↺ Volver a consultar' : '✨ Enviar a Asistente IA'}
                      </button>

                      {(respuestasIa[pregunta.id] || enviandoIa[pregunta.id]) ? (
                        <>
                          {enviandoIa[pregunta.id] && !respuestasIa[pregunta.id] && (
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
                            ref={el => { iaEditorRefs.current[pregunta.id] = el; }}
                            value={respuestasIa[pregunta.id] ?? ''}
                            onChange={v => setRespuestasIa(prev => ({ ...prev, [pregunta.id]: v }))}
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
                          {pregunta.iaAutomatica
                            ? 'El asistente generará el análisis automáticamente al ingresar al paso.'
                            : <>Aún no has consultado al asistente. Escribe tu respuesta arriba y presiona <strong>Enviar a Asistente IA</strong>.</>}
                        </div>
                      )}
                    </div>
                  )}

                  </div>
                </div>
              </div>
            );
          })}

          {/* Botones anterior / siguiente */}
          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            {currentStepIndex > 0 ? (
              <button className="btn btn-secondary" onClick={handleAnterior} disabled={loading}
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.9375rem' }}>
                ← Paso anterior
              </button>
            ) : <div />}
            <button
              className="btn btn-primary"
              onClick={handleSiguiente}
              disabled={!pasoCompleto || loading || anyEnviando}
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
