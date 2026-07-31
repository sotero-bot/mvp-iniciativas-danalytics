import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WysiwygEditor, WysiwygEditorHandle } from '../../components/WysiwygEditor';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from '../../components/toast-store';
import { buildResumenHtml } from './buildResumenHtml';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { StatusBadge, Button } from '../../components/ui';

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
  orden: number;
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
  esCanvas?: boolean;
}

/* ── Brand header ── */
function RunnerHeader({ nombreActividad, nombreEmpresa, logoEmpresa }: {
  nombreActividad?: string;
  nombreEmpresa?: string;
  logoEmpresa?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 52,
      background: 'var(--color-bg-card)',
      borderBottom: '1px solid var(--color-border)',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      padding: '0 1.5rem',
    }}>
      <img
        src="/logo-horizontal.png"
        alt="Danalytics"
        style={{ height: 36, objectFit: 'contain', flexShrink: 0, justifySelf: 'start' }}
      />

      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>
        {t('app_name')}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'end' }}>
        {(nombreEmpresa || nombreActividad) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0 }}>
            <div style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }} />
            {logoEmpresa ? (
              <img src={logoEmpresa} alt={nombreEmpresa}
                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'contain', flexShrink: 0, border: '1px solid var(--color-border)' }} />
            ) : nombreEmpresa ? (
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, color: 'white',
              }}>
                {nombreEmpresa.charAt(0).toUpperCase()}
              </div>
            ) : null}
            <span style={{
              fontSize: '0.78rem', color: 'var(--color-text-secondary)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {nombreEmpresa && <span style={{ fontWeight: 600 }}>{nombreEmpresa}</span>}
              {nombreEmpresa && nombreActividad && <span style={{ color: 'var(--color-border-strong)', margin: '0 5px' }}>·</span>}
              {nombreActividad && <span>{nombreActividad}</span>}
            </span>
          </div>
        )}
        <div style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }} />
        <LanguageSwitcher variant="header" />
      </div>
    </div>
  );
}

/* ── Section block ── */
function SectionBlock({
  number, title, description, children,
}: {
  number: number; title: string; description?: string;
  color?: 'blue' | 'violet' | 'purple'; children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid var(--color-info-border)', overflow: 'hidden', marginBottom: 'var(--space-5)' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
        padding: '0.75rem 1.25rem', background: 'var(--color-info-bg)', borderBottom: '1px solid var(--color-info-border)',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', background: 'var(--color-info)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, marginTop: 1,
        }}>{number}</div>
        <div>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-primary-hover)', display: 'block' }}>{title}</span>
          {description && (
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 1, display: 'block' }}>{description}</span>
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
          style={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', display: 'block', margin: '0 auto 10px' }} />
      ) : nombreEmpresa ? (
        <div style={{
          width: 64, height: 64,
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', fontWeight: 700, color: 'white',
          margin: '0 auto 10px',
        }}>
          {nombreEmpresa.charAt(0).toUpperCase()}
        </div>
      ) : null}
      <h2 style={{ fontSize: '1.125rem', margin: 0 }}>
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
          borderRadius: 'var(--radius-pill)',
          background: i < current ? 'var(--color-primary)' : i === current ? 'var(--color-primary-hover)' : 'var(--color-border)',
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
  ctx?: PromptCtx,
  pasoOrden?: number
): string {
  let result = prompt;

  result = result
    .replace(/\{\{empresa\.nombre\}\}/g, ctx?.empresa?.nombre || '[nombre de organización no disponible]')
    .replace(/\{\{empresa\.sector\}\}/g, ctx?.empresa?.sector || '[sector no disponible]')
    .replace(/\{\{empresa\.tipoOrganizacion\}\}/g, ctx?.empresa?.tipoOrganizacion || '[tipo de organización no disponible]')
    .replace(/\{\{idenForm\.area\}\}/g, ctx?.usuario?.area || '[área no disponible]')
    .replace(/\{\{idenForm\.cargo\}\}/g, ctx?.usuario?.cargo || '[cargo no disponible]');

  if (result.includes('{{paso_')) {
    result = result.replace(/\{\{paso_(\d+)\}\}/g, (_match, nStr) => {
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

  // Si el template tiene secciones "# Bloque N —", conservar solo la del paso actual.
  // Los datos de pasos anteriores siguen llegando como {{paso_N}} dentro del bloque activo.
  if (pasoOrden !== undefined && /^# Bloque \d+/m.test(result)) {
    const partes = result.split(/(?=^# Bloque \d+)/m);
    result = partes
      .filter(parte => {
        const match = parte.match(/^# Bloque (\d+)/);
        if (!match) return true;
        return parseInt(match[1], 10) === pasoOrden;
      })
      .join('');
  }

  return result;
}

export function RunnerPage() {
  const { t, i18n } = useTranslation(['execution', 'common']);
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<RunnerData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Per-pregunta state maps (keyed by preguntaId)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [respuestasIa, setRespuestasIa] = useState<Record<string, string>>({});
  const [archivosRespuesta, setArchivosRespuesta] = useState<Record<string, File | null>>({});
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [enviandoIa, setEnviandoIa] = useState<Record<string, boolean>>({});

  const [idenForm, setIdenForm] = useState({ nombre: '', email: '', cargo: '', area: '' });
  const [wasValidated, setWasValidated] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canvasGenerando, setCanvasGenerando] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [error, setError] = useState('');
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
      const res = await fetch(`${API_URL}/execution/${token}?locale=${i18n.language}`);
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

      const empresaCtx = { nombre: json.nombreEmpresa, sector: json.sectorEmpresa, tipoOrganizacion: json.tipoOrganizacionEmpresa };
      const usuarioCtx = json.usuario ? { area: json.usuario.area, cargo: json.usuario.cargo } : undefined;
      const interpolar = (base: string, pasoOrden?: number) => interpolarPrompt(base, json.pasos, json.respuestas ?? [], { empresa: empresaCtx, usuario: usuarioCtx }, pasoOrden);

      if (json.estado !== 'generado') {
        const lastAnsweredIndex = json.pasos.findIndex((p: Paso) => !pasoRespondido(p));
        if (lastAnsweredIndex !== -1) {
          setCurrentStepIndex(lastAnsweredIndex);
          const paso = json.pasos[lastAnsweredIndex];
          for (const q of (paso.preguntas ?? [])) {
            const base = getBasePrompt(q);
            if (base) promptsMap[q.id] = interpolar(base, paso.orden);
          }
        } else if (json.estado === 'finalizado') {
          setCurrentStepIndex(json.pasos.length);
        } else {
          const lastIdx = json.pasos.length - 1;
          setCurrentStepIndex(lastIdx);
          const paso = json.pasos[lastIdx];
          for (const q of (paso?.preguntas ?? [])) {
            const base = getBasePrompt(q);
            if (base) promptsMap[q.id] = interpolar(base, paso.orden);
          }
        }
      } else if (json.pasos.length > 0) {
        const paso = json.pasos[0];
        for (const q of (paso.preguntas ?? [])) {
          const base = getBasePrompt(q);
          if (base) promptsMap[q.id] = interpolar(base, paso.orden);
        }
      }
      setCustomPrompts(promptsMap);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const lang = searchParams.get('lang');
    if (lang && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
      i18n.changeLanguage(lang);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [token, i18n.language]);

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
          const interpolado = interpolarPrompt(base, data.pasos, data.respuestas, { empresa: { nombre: data.nombreEmpresa, sector: data.sectorEmpresa, tipoOrganizacion: data.tipoOrganizacionEmpresa }, usuario: { area: idenForm.area, cargo: idenForm.cargo } }, paso.orden);
          const formData = new FormData();
          formData.append('pasoId', paso.id);
          // TODO(IA-por-pregunta): revisar al implementar — enviar preguntaId en lugar de (o además de) pasoId.
          formData.append('respuesta', '');
          if (interpolado) formData.append('customPrompt', interpolado);
          formData.append('locale', i18n.language);
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
      toast.error(t('execution:runner.identification.start_failed_generic'));
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
    if (loading) return;
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
        toast.success(t('execution:runner.identification.welcome_back', { nombre: result.nombre }));
      } else {
        toast.success(t('execution:runner.identification.register_success'));
      }
    } catch (err: any) {
      toast.error(translateError(err));
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
        body: JSON.stringify({ respuestaIa: respuestasIa[preguntaId] || undefined, locale: i18n.language }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any)?.message || t('execution:runner.errors.download_template_failed'));
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
      toast.error(t('execution:runner.errors.download_template_retry'));
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
          return toast.error(t('execution:runner.errors.consult_ia_first', { enunciado: q.enunciado.slice(0, 60) }));
        }
        if (q.soloArchivo || q.permitirArchivo) {
          return toast.error(t('execution:runner.errors.attach_file_required'));
        }
        return toast.error(t('execution:runner.errors.answer_all'));
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
        return toast.error(t('execution:runner.errors.save_failed'));
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
        if (base) promptsMap[q.id] = interpolarPrompt(base, data!.pasos, newRespuestas, { empresa: { nombre: data!.nombreEmpresa, sector: data!.sectorEmpresa, tipoOrganizacion: data!.tipoOrganizacionEmpresa }, usuario: { area: idenForm.area, cargo: idenForm.cargo } }, sig.orden);
      }
      setCustomPrompts(promptsMap);

      setCurrentStepIndex(currentStepIndex + 1);
      setArchivosRespuesta({});
    } else {
      await fetch(`${API_URL}/execution/${token}/finalizar`, { method: 'POST' });
      if (data?.esCanvas) {
        setCanvasGenerando(true);
        await fetch(`${API_URL}/execution/${token}/canvas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: i18n.language }),
        });
        setCanvasGenerando(false);
      }
      await loadData();
    }
    setLoading(false);
  };

  // TODO(IA-por-pregunta): revisar al implementar — enviar preguntaId junto a pasoId para que
  // el backend lea usarIa/promptIa de PreguntaActividad en lugar de PasoActividad.
  const handleEnviarIA = async (paso: Paso, pregunta: Pregunta) => {
    if (!pregunta.iaAutomatica && !respuestas[pregunta.id]?.trim()) {
      return toast.error(t('execution:runner.errors.ia_write_first'));
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
      formData.append('locale', i18n.language);

      const res = await fetch(`${API_URL}/execution/${token}/ia`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Error al consultar la IA');

      const json = await res.json();
      setRespuestasIa(prev => ({ ...prev, [pregunta.id]: json.respuestaIa }));
      iaEditorRefs.current[pregunta.id]?.replaceContent(json.respuestaIa);
    } catch {
      toast.error(t('execution:runner.errors.ia_connect_failed'));
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
    setLoading(false);
  };

  /* ── Loading / Error ── */
  if (loading && !data) return (
    <>
      <RunnerHeader />
      <div className="runner-center" style={{ paddingTop: 52 }}>
        <span className="spinner" aria-hidden="true" />
        {t('execution:runner.loading_activity')}
      </div>
    </>
  );

  if (error) return (
    <>
      <RunnerHeader />
      <div className="runner-center" style={{ paddingTop: 52, color: 'var(--color-danger)' }}>⚠ {error}</div>
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{t('execution:runner.stats.pasos')}</div>
                </div>
              </div>
            </div>

            {!data.usuarioId ? (
              <form
                className={wasValidated ? 'was-validated' : ''}
                onSubmit={onSubmitIdentificacion}
                noValidate
              >
                <h3 style={{ marginBottom: 4 }}>{t('execution:runner.identification.header_title')}</h3>
                <p style={{ marginBottom: 24, fontSize: '0.875rem' }}>
                  {t('execution:runner.identification.header_subtitle')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>{t('execution:runner.identification.email_label')}</label>
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
                      placeholder={t('execution:runner.identification.email_placeholder')} />
                    <div className="invalid-feedback">{t('execution:runner.identification.email_invalid')}</div>
                  </div>
                  <div>
                    <label className="required-label" style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>{t('execution:runner.identification.nombre_label')}</label>
                    <input className="input" required value={idenForm.nombre}
                      onChange={e => setIdenForm({ ...idenForm, nombre: e.target.value })}
                      placeholder={t('execution:runner.identification.nombre_placeholder')} />
                    <div className="invalid-feedback">{t('execution:runner.identification.nombre_required')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>{t('execution:runner.identification.cargo_label')}</label>
                      <input className="input" value={idenForm.cargo}
                        onChange={e => setIdenForm({ ...idenForm, cargo: e.target.value })}
                        placeholder={t('execution:runner.identification.cargo_placeholder')} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500 }}>{t('execution:runner.identification.area_label')}</label>
                      <input className="input" value={idenForm.area}
                        onChange={e => setIdenForm({ ...idenForm, area: e.target.value })}
                        placeholder={t('execution:runner.identification.area_placeholder')} />
                    </div>
                  </div>
                </div>

                <Button type="submit" block disabled={loading}
                  style={{ marginTop: 28 }}>
                  {loading ? t('execution:runner.identification.registering') : t('execution:runner.identification.start_button')}
                </Button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                {t('execution:runner.identification.starting')}
              </div>
            )}
          </div>
        </div>

        <ConfirmModal
          isOpen={showEmailConfirm}
          title={t('execution:runner.identification.email_confirm_title')}
          message={t('execution:runner.identification.email_confirm_message', { email: idenForm.email })}
          confirmLabel={t('execution:runner.identification.email_confirm_button')}
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
              background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', fontSize: '1.75rem',
            }}>✓</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>{t('execution:runner.completed.title')}</h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32, maxWidth: 380, margin: '0 auto 32px' }}>
              {t('execution:runner.completed.description')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={`/runner/${token}/resultados`} className="btn btn-primary"
                style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem', textDecoration: 'none', display: 'inline-flex' }}>
                {t('execution:runner.completed.view_results')}
              </a>
              <Button variant="secondary" onClick={handleDescargarResumen}
                style={{ padding: '0.75rem 2rem', fontSize: '0.9375rem' }}>
                {t('execution:runner.completed.download_html')}
              </Button>
            </div>
            <p style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
              {t('execution:runner.completed.close_hint')}
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
            <div style={{ marginBottom: 20, border: '1px solid var(--color-info-border)', overflow: 'hidden' }}>
              <button
                onClick={() => setPlantillaAnteriorExpanded(e => !e)}
                style={{
                  width: '100%', background: 'var(--color-info-bg)', border: 'none',
                  padding: '11px 16px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-primary-hover)' }}>
                  {t('execution:runner.plantilla_anterior.title', { nombre: data.plantillaAnterior.nombre })}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-info)', flexShrink: 0 }}>
                  {plantillaAnteriorExpanded ? t('execution:runner.plantilla_anterior.collapse') : t('execution:runner.plantilla_anterior.expand')}
                </span>
              </button>
              {plantillaAnteriorExpanded && (
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.plantillaAnterior.respuestas.map((r, i) => {
                    const contenido = r.contenidoArchivo || r.respuestaUsuario || r.respuestaIa || r.contenido || '';
                    return (
                      <div key={i} style={{
                        borderBottom: i < data.plantillaAnterior!.respuestas.length - 1 ? '1px solid var(--color-border-soft)' : 'none',
                        paddingBottom: i < data.plantillaAnterior!.respuestas.length - 1 ? 14 : 0,
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-info)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('execution:runner.plantilla_anterior.step_label', { orden: r.pasoOrden, titulo: r.pasoTitulo })}
                        </div>
                        {contenido ? (
                          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-main)', lineHeight: 1.65 }} className="markdown-anterior">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contenido}</ReactMarkdown>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('execution:results.no_response')}</span>
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
                {t('execution:runner.step_progress', { current: currentStepIndex + 1, total: data.pasos.length })}
              </span>
              {isLastStep && (
                <StatusBadge variant="warning">{t('execution:runner.last_step')}</StatusBadge>
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
            <SectionBlock number={1} title={t('execution:runner.instructions.section_title')} description={t('execution:runner.instructions.section_subtitle')}>
              {currentPaso.instrucciones && (
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {currentPaso.instrucciones}
                </p>
              )}
              {currentPaso.ejemploKey && (
                <div style={{
                  marginTop: currentPaso.instrucciones ? 14 : 0,
                  padding: '10px 14px',
                  background: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-success-strong)' }}>{t('execution:runner.example_file.title')}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-success-strong)', flex: 1, minWidth: 160 }}>
                    {t('execution:runner.example_file.subtitle')}
                  </span>
                  <button
                    className="btn"
                    style={{ padding: '5px 14px', fontSize: '0.82rem', background: 'var(--color-success-strong)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_URL}/execution/${token}/pasos/${currentPaso.id}/ejemplo-url`);
                        const json = await res.json();
                        if (json.url) window.open(json.url, '_blank');
                      } catch { toast.error(t('execution:runner.errors.download_example_failed')); }
                    }}
                  >
                    {t('execution:runner.example_file.download')}
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
            const iaRespondida = !!data.respuestas.find(r => r.preguntaId === pregunta.id)?.respuestaIa;
            const estaGenerando = !!enviandoIa[pregunta.id];

            return (
              <div key={pregunta.id} style={{
                border: '1px solid var(--color-border)',
                borderRadius: 0,
                overflow: 'hidden',
                marginBottom: 16,
              }}>
                {/* Pregunta header */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 20px',
                  background: 'var(--color-bg-page)',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-text-main)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, marginTop: 2,
                  }}>{qIdx + 1}</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-main)', lineHeight: 1.6, fontWeight: 500 }}>
                    {pregunta.enunciado}
                  </p>
                </div>

                {/* Respuesta body */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={iaFirst ? { display: 'flex', flexDirection: 'column' } : undefined}>

                  {/* Template download — order 0 when iaFirst: shown before IA and before upload */}
                  {iaFirst && pregunta.urlPlantilla && (
                    <div style={{ order: 0 }}>
                      <div style={{ padding: '16px 20px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'var(--color-success-strong)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-success-strong)' }}>{t('execution:runner.plantilla_priorizacion.title')}</span>
                        </div>
                        <p style={{ margin: '0 0 12px 34px', fontSize: '0.82rem', color: 'var(--color-success-strong)', lineHeight: 1.5 }}>
                          {t('execution:runner.plantilla_priorizacion.description')}
                        </p>
                        <div style={{ marginLeft: 34 }}>
                          {pregunta.iaAutomatica && !iaRespondida ? (
                            <span style={{ fontSize: '0.82rem', color: 'var(--color-info)', fontStyle: 'italic' }}>
                              {estaGenerando ? t('execution:runner.plantilla_priorizacion.generating_ideas') : t('execution:runner.plantilla_priorizacion.waiting_ia')}
                            </span>
                          ) : iaRespondida ? (
                            <button
                              onClick={() => handleDescargarPlantillaPrediligenciada(currentPaso.id, pregunta.id)}
                              disabled={descargandoExcel}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: '0.85rem', background: descargandoExcel ? 'var(--color-success-bg)' : 'var(--color-success-strong)', color: descargandoExcel ? 'var(--color-success-strong)' : 'white', fontWeight: 600, border: 'none', cursor: descargandoExcel ? 'wait' : 'pointer' }}
                            >
                              {descargandoExcel ? t('execution:runner.plantilla_priorizacion.generating') : t('execution:runner.plantilla_priorizacion.download_prefilled')}
                            </button>
                          ) : (
                            <a href={pregunta.urlPlantilla} download style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: '0.85rem', background: 'var(--color-success-strong)', color: 'white', fontWeight: 600, border: 'none', textDecoration: 'none' }}>
                              {t('execution:runner.plantilla_priorizacion.download_empty')}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tu respuesta */}
                  {showRespuesta && (
                    <div style={iaFirst ? { order: 1 } : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary-hover)',
                          background: 'var(--color-primary-light)', border: '1px solid var(--color-info-border)',
                          padding: '2px 8px', borderRadius: 'var(--radius-chip)', letterSpacing: '0.02em',
                        }}>{t('execution:runner.your_response_label')}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          {(pregunta.permitirArchivo || pregunta.soloArchivo)
                            ? t('execution:runner.your_response_help_file')
                            : pregunta.usarIa
                              ? t('execution:runner.your_response_help_ia')
                              : t('execution:runner.your_response_help_default')}
                        </span>
                      </div>

                      {!pregunta.permitirArchivo && !pregunta.soloArchivo && (
                        <WysiwygEditor
                          ref={el => { editorRefs.current[pregunta.id] = el; }}
                          value={respuestas[pregunta.id] ?? ''}
                          onChange={v => setRespuestas(prev => ({ ...prev, [pregunta.id]: v }))}
                          placeholder={t('execution:runner.answer_placeholder')}
                          minHeight={180}
                        />
                      )}

                      {/* Plantilla + archivo upload */}
                      {(pregunta.permitirArchivo || pregunta.soloArchivo) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                          {!iaFirst && pregunta.urlPlantilla && (() => {
                            return (
                              <div style={{ padding: '16px 20px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'var(--color-success-strong)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</div>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-success-strong)' }}>{t('execution:runner.plantilla_priorizacion.title')}</span>
                                </div>
                                <p style={{ margin: '0 0 12px 34px', fontSize: '0.82rem', color: 'var(--color-success-strong)', lineHeight: 1.5 }}>
                                  {t('execution:runner.plantilla_priorizacion.description')}
                                </p>
                                <div style={{ marginLeft: 34 }}>
                                  {pregunta.iaAutomatica && !iaRespondida ? (
                                    <span style={{ fontSize: '0.82rem', color: 'var(--color-info)', fontStyle: 'italic' }}>
                                      {estaGenerando ? t('execution:runner.plantilla_priorizacion.generating_ideas') : t('execution:runner.plantilla_priorizacion.waiting_ia')}
                                    </span>
                                  ) : iaRespondida ? (
                                    <button
                                      onClick={() => handleDescargarPlantillaPrediligenciada(currentPaso.id, pregunta.id)}
                                      disabled={descargandoExcel}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        padding: '8px 18px', fontSize: '0.85rem',
                                        background: descargandoExcel ? 'var(--color-success-bg)' : 'var(--color-success-strong)', color: descargandoExcel ? 'var(--color-success-strong)' : 'white',
                                        fontWeight: 600, border: 'none', cursor: descargandoExcel ? 'wait' : 'pointer',
                                      }}
                                    >
                                      {descargandoExcel ? t('execution:runner.plantilla_priorizacion.generating') : t('execution:runner.plantilla_priorizacion.download_prefilled')}
                                    </button>
                                  ) : (
                                    <a href={pregunta.urlPlantilla} download style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 8,
                                      padding: '8px 18px', fontSize: '0.85rem',
                                      background: 'var(--color-success-strong)', color: 'white',
                                      fontWeight: 600, border: 'none', textDecoration: 'none',
                                    }}>{t('execution:runner.plantilla_priorizacion.download_empty')}</a>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Subir archivo */}
                          <div style={{
                            padding: '16px 20px',
                            background: archivoResp ? 'var(--color-primary-light)' : 'var(--color-bg-page)',
                            border: `2px ${archivoResp ? 'solid var(--color-accent)' : 'dashed var(--color-border-strong)'}`,
                            borderRadius: 0,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: archivoResp ? 'var(--color-primary)' : 'var(--color-text-tertiary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                {pregunta.urlPlantilla ? '2' : '1'}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: archivoResp ? 'var(--color-primary-hover)' : 'var(--color-text-secondary)' }}>{t('execution:runner.upload_file.title')}</span>
                            </div>
                            <div style={{ marginLeft: 34, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '8px 18px', fontSize: '0.85rem',
                                background: archivoResp ? 'var(--color-primary-muted)' : 'white', color: archivoResp ? 'var(--color-primary-hover)' : 'var(--color-text-secondary)',
                                borderRadius: 0, cursor: 'pointer', fontWeight: 600,
                                border: `1px solid ${archivoResp ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
                              }}>
                                {archivoResp ? `✓ ${archivoResp.name}` : t('execution:runner.upload_file.select_button')}
                                <input type="file" accept=".xlsx,.xls,.csv"
                                  style={{ display: 'none' }}
                                  onChange={e => setArchivosRespuesta(prev => ({ ...prev, [pregunta.id]: e.target.files?.[0] || null }))} />
                              </label>
                              {archivoResp && (
                                <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                                  onClick={() => setArchivosRespuesta(prev => ({ ...prev, [pregunta.id]: null }))}>{t('execution:runner.remove')}</button>
                              )}
                            </div>
                            {/* Download link for previously uploaded S3 file */}
                            {(() => {
                              const prev = data.respuestas.find(r => r.preguntaId === pregunta.id);
                              if (!prev?.archivoNombre || !prev?.archivoKey) return null;
                              return (
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{t('execution:runner.upload_file.already_uploaded')} <strong>{prev.archivoNombre}</strong></span>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`${API_URL}/execution/${token}/respuestas/${pregunta.id}/archivo-url`);
                                        const json = await res.json();
                                        if (json.url) window.open(json.url, '_blank');
                                      } catch { toast.error(t('execution:runner.errors.download_example_failed')); }
                                    }}
                                  >
                                    {t('execution:runner.upload_file.download')}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>

                        </div>
                      )}

                    </div>
                  )}

                  {/* Asistente IA */}
                  {pregunta.usarIa && (
                    <div style={iaFirst ? { order: 2, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-info-border)' } : { marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-info-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-info)',
                          background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)',
                          padding: '2px 8px', borderRadius: 'var(--radius-chip)', letterSpacing: '0.02em',
                        }}>{t('execution:runner.ia_label')}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          {pregunta.iaAutomatica
                            ? t('execution:runner.ia_help_automatica')
                            : t('execution:runner.ia_help_manual')}
                        </span>
                      </div>

                      {pregunta.iaAutomatica && (
                        <div style={{
                          marginBottom: 14, padding: '8px 14px',
                          background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 0,
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontSize: '0.82rem', color: 'var(--color-info)', fontWeight: 500,
                        }}>
                          <span>⚡</span>
                          <span>{t('execution:runner.ia_automatica_banner')}</span>
                        </div>
                      )}

                      {/* "Ver prompt base" oculto — no se muestra al participante */}

                      <Button
                        variant="secondary"
                        style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleEnviarIA(currentPaso, pregunta)}
                        disabled={(!pregunta.iaAutomatica && !respuestas[pregunta.id]?.trim()) || !!enviandoIa[pregunta.id]}
                      >
                        {enviandoIa[pregunta.id] ? (
                          <>
                            <span style={{ width: 12, height: 12, border: '2px solid var(--color-info-border)', borderTopColor: 'var(--color-info)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                            {t('execution:runner.ia_consulting')}
                          </>
                        ) : pregunta.iaAutomatica ? t('execution:runner.ia_retry') : t('execution:runner.ia_send_button')}
                      </Button>

                      {(respuestasIa[pregunta.id] || enviandoIa[pregunta.id]) ? (
                        <>
                          {enviandoIa[pregunta.id] && !respuestasIa[pregunta.id] && (
                            <div style={{
                              padding: '1.5rem', textAlign: 'center', color: 'var(--color-info)',
                              fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                              background: 'var(--color-info-bg)', borderRadius: 0, marginBottom: 10,
                            }}>
                              <span style={{ width: 16, height: 16, border: '2px solid var(--color-info-border)', borderTopColor: 'var(--color-info)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                              {t('execution:runner.ia_generating')}
                            </div>
                          )}
                          <WysiwygEditor
                            ref={el => { iaEditorRefs.current[pregunta.id] = el; }}
                            value={respuestasIa[pregunta.id] ?? ''}
                            onChange={v => setRespuestasIa(prev => ({ ...prev, [pregunta.id]: v }))}
                            placeholder={t('execution:runner.ia_response_placeholder')}
                            minHeight={180}
                            borderColor="var(--color-info-border)"
                          />
                        </>
                      ) : (
                        <div style={{
                          padding: '1.25rem', borderRadius: 0, background: 'var(--color-info-bg)',
                          border: '1px dashed var(--color-info-border)', textAlign: 'center',
                          color: 'var(--color-info)', fontSize: '0.85rem',
                        }}>
                          {pregunta.iaAutomatica
                            ? t('execution:runner.ia_response_empty_automatica')
                            : <>{t('execution:runner.ia_response_empty_manual_prefix')}<strong>{t('execution:runner.ia_response_empty_manual_button')}</strong>.</>}
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
          <div className="form-footer" style={{ marginTop: 4, justifyContent: 'space-between' }}>
            {currentStepIndex > 0 ? (
              <Button variant="secondary" onClick={handleAnterior} disabled={loading}>
                {t('execution:runner.previous_step')}
              </Button>
            ) : <div />}
            <Button
              onClick={handleSiguiente}
              disabled={!pasoCompleto || loading || anyEnviando}
            >
              {canvasGenerando ? t('execution:runner.preparing_results') : loading ? t('execution:runner.saving') : isLastStep ? t('execution:runner.finish_workshop') : t('execution:runner.next_step')}
            </Button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .markdown-anterior p { margin: 0 0 6px; }
        .markdown-anterior p:last-child { margin-bottom: 0; }
        .markdown-anterior table { border-collapse: collapse; width: 100%; font-size: 0.82rem; margin: 6px 0; }
        .markdown-anterior th { background: var(--color-info-bg); color: var(--color-primary-hover); font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid var(--color-info-border); }
        .markdown-anterior td { padding: 5px 10px; border: 1px solid var(--color-border-soft); vertical-align: top; }
        .markdown-anterior tr:nth-child(even) td { background: var(--color-bg-subtle); }
        .markdown-anterior ul, .markdown-anterior ol { margin: 4px 0; padding-left: 18px; }
        .markdown-anterior li { margin-bottom: 2px; }
        .markdown-anterior strong { font-weight: 600; }
      `}</style>
    </>
  );
}
