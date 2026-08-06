import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { StatusBadge, Modal, Button } from '../../components/ui';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildResumenHtml } from './buildResumenHtml';
import { CanvasGrid } from './CanvasGrid';
import { buildCanvasHtml } from './buildCanvasHtml';
import { fetchWithErrorMapping, translateError } from '../../shared/api/fetchWithErrorMapping';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Pregunta {
    id: string;
    enunciado: string;
    usarIa?: boolean;
    soloArchivo?: boolean;
    permitirArchivo?: boolean;
}

interface Paso {
    id: string;
    titulo: string;
    orden: number;
    objetivo?: string;
    usarIa?: boolean;
    preguntas?: Pregunta[];
}

interface Interaccion {
    pasoId: string;
    contenido: string;
    contenidoArchivo?: string;
    fecha: string;
}

interface RespuestaPregunta {
    preguntaId: string;
    contenido?: string;
    respuestaUsuario?: string;
    respuestaIa?: string;
    archivoNombre?: string;
    contenidoArchivo?: string;
    fecha: string;
}

interface RunnerData {
    estado: string;
    nombreActividad: string;
    descripcionActividad?: string;
    esCanvas: boolean;
    nombreEmpresa?: string;
    pasos: Paso[];
    interacciones: Interaccion[];
    respuestas?: RespuestaPregunta[];
    fechaInicio?: string;
    fechaFin?: string;
}

export function RunnerResultsPage() {
    const { t, i18n } = useTranslation(['execution', 'common']);
    const { token } = useParams<{ token: string }>();
    const [data, setData] = useState<RunnerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [canvasBloques, setCanvasBloques] = useState<Record<string, string>>({});
    const [canvasLoading, setCanvasLoading] = useState(false);
    const [showRegenerarModal, setShowRegenerarModal] = useState(false);

    // Recarga datos (títulos, preguntas) cuando cambia el idioma
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetchWithErrorMapping(`${API_URL}/execution/${token}?locale=${i18n.language}`);
                const json: RunnerData = await res.json();
                setData(json);
            } catch (err) {
                setError(translateError(err));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, i18n.language]);

    // Carga el canvas solo al montar — no se repite al cambiar idioma
    useEffect(() => {
        const fetchCanvas = async () => {
            setCanvasLoading(true);
            try {
                const canvasRes = await fetch(`${API_URL}/execution/${token}/canvas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ locale: i18n.language }),
                });
                if (canvasRes.ok) {
                    const canvasJson = await canvasRes.json();
                    setCanvasBloques(canvasJson.bloques ?? {});
                }
            } catch {
                // No bloquear el render si falla la síntesis
            } finally {
                setCanvasLoading(false);
            }
        };
        fetchCanvas();
    }, [token]); // solo token — no i18n.language

    if (loading) return (
        <div className="runner-center">
            <span className="spinner" aria-hidden="true" />
            {t('execution:results.loading')}
        </div>
    );
    if (error) return <div className="runner-center" style={{ color: 'var(--color-danger)' }}>⚠ {error}</div>;
    if (!data) return null;

    const markdownBoxStyle: CSSProperties = {
        padding: 'var(--space-4) var(--space-5)', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: 'var(--color-text-main)', lineHeight: 1.7, overflowX: 'auto',
    };

    const respuestasPorPregunta = new Map((data.respuestas ?? []).map(r => [r.preguntaId, r]));

    const pasoRespondido = (p: Paso) =>
        p.preguntas && p.preguntas.length > 0
            ? p.preguntas.every(q => respuestasPorPregunta.has(q.id))
            : data.interacciones.some(i => i.pasoId === p.id);

    const completedCount = data.pasos.filter(pasoRespondido).length;
    const dateLocale = i18n.language?.startsWith('pt') ? 'pt-BR' : 'es-AR';

    const handleDescargar = () => {
        const html = buildResumenHtml({
            nombreActividad: data.nombreActividad,
            descripcionActividad: data.descripcionActividad,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            pasos: data.pasos,
            interacciones: data.interacciones,
            respuestas: data.respuestas,
        });
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resumen-${data.nombreActividad.replace(/\s+/g, '-').toLowerCase()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleGenerarCanvas = async (force = false) => {
        setCanvasLoading(true);
        try {
            const res = await fetch(`${API_URL}/execution/${token}/canvas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: i18n.language, force }),
            });
            if (res.ok) {
                const json = await res.json();
                setCanvasBloques(json.bloques ?? {});
            }
        } catch {
            // silently fail — user can retry
        } finally {
            setCanvasLoading(false);
        }
    };

    const handleDescargarCanvas = () => {
        const fechaStr = data.fechaFin
            ? new Date(data.fechaFin).toLocaleDateString(dateLocale)
            : new Date().toLocaleDateString(dateLocale);
        const html = buildCanvasHtml({
            bloques: canvasBloques,
            pasos: data.pasos.map(p => ({ id: p.id, titulo: p.titulo, orden: p.orden })),
            empresa: data.nombreEmpresa || 'N/A',
            area: 'N/A',
            proyecto: data.nombreActividad,
            fecha: fechaStr,
            locale: i18n.language,
        });
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `canvas-${data.nombreActividad.replace(/\s+/g, '-').toLowerCase()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
        <Modal
            isOpen={showRegenerarModal}
            onClose={() => setShowRegenerarModal(false)}
            title={t('execution:results.regenerate_modal.title')}
            maxWidth={420}
            footer={
                <>
                    <Button variant="secondary" onClick={() => setShowRegenerarModal(false)}>
                        {t('common:buttons.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => { setShowRegenerarModal(false); handleGenerarCanvas(true); }}
                    >
                        {t('execution:results.regenerate_modal.confirm')}
                    </Button>
                </>
            }
        >
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {t('execution:results.regenerate_modal.body')}
            </p>
        </Modal>
        <div style={{
            minHeight: '100vh',
            background: 'var(--color-bg-page)',
            padding: `0 var(--space-4) var(--space-6)`,
        }}>

            {/* Top bar */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'var(--color-bg-card)',
                padding: '0 var(--space-5)', height: 52,
                display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
            }}>
                <img
                    src="/logo-horizontal.png"
                    alt="Danalytics"
                    style={{ height: 36, objectFit: 'contain', justifySelf: 'start' }}
                />
                <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text-heading)' }}>
                    {t('common:app_name')}
                </span>
                <div style={{ justifySelf: 'end', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <LanguageSwitcher variant="header" />
                    {data.esCanvas ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleDescargarCanvas}
                            disabled={canvasLoading || Object.keys(canvasBloques).length === 0}
                        >
                            {canvasLoading ? t('execution:results.generating') : t('execution:results.download_canvas')}
                        </Button>
                    ) : (
                        <Button variant="primary" size="sm" onClick={handleDescargar}>
                            {t('execution:results.download_html')}
                        </Button>
                    )}
                </div>
            </div>

            <div style={{ maxWidth: 1560, margin: '0 auto', paddingTop: 'var(--space-6)' }}>

                {/* Header */}
                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <StatusBadge variant="success">{t('execution:results.completed_badge')}</StatusBadge>
                            </div>
                            <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>{data.nombreActividad}</h1>
                            {data.descripcionActividad && (
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)', maxWidth: 480, textAlign: 'justify' }}>
                                    {data.descripcionActividad}
                                </p>
                            )}
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: 'var(--space-5)', flexShrink: 0 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{completedCount}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{t('execution:results.stats.pasos_completados')}</div>
                            </div>
                            {data.fechaFin && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                                        {new Date(data.fechaFin).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{t('execution:results.stats.fecha_finalizacion')}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Canvas Grid — solo si es Analytics Canvas */}
                {data.esCanvas && (
                    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                        {canvasLoading ? (
                            <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.9rem', padding: 'var(--space-6)' }}>
                                {t('execution:results.generating_canvas')}
                            </div>
                        ) : Object.keys(canvasBloques).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
                                    {t('execution:results.canvas_not_generated')}
                                </p>
                                <Button variant="primary" onClick={() => handleGenerarCanvas()}>
                                    {t('execution:results.generate_canvas')}
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-4)' }}>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setShowRegenerarModal(true)}
                                        disabled={canvasLoading}
                                    >
                                        ↺ {t('execution:results.regenerate_canvas')}
                                    </Button>
                                </div>
                                <CanvasGrid
                                    bloques={canvasBloques}
                                    pasos={data.pasos.map(p => ({ id: p.id, titulo: p.titulo, orden: p.orden }))}
                                />
                            </>
                        )}
                    </div>
                )}

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {data.pasos.map((paso, idx) => {
                        const preguntas = paso.preguntas ?? [];
                        const respondido = pasoRespondido(paso);
                        return (
                            <div key={paso.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Step header */}
                                <div style={{
                                    padding: 'var(--space-4) var(--space-5)',
                                    background: 'var(--color-bg-subtle)',
                                    display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
                                }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                        background: respondido ? 'var(--color-primary)' : 'var(--color-border)',
                                        color: 'var(--color-bg-card)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.78rem', fontWeight: 700,
                                    }}>
                                        {respondido ? idx + 1 : '—'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-main)' }}>
                                            {paso.titulo}
                                        </div>
                                        {paso.objetivo && (
                                            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--color-primary)', fontStyle: 'italic', textAlign: 'justify' }}>
                                                {paso.objetivo}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Step response */}
                                <div style={{ padding: 'var(--space-5)' }}>
                                    {preguntas.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                            {preguntas.map((q, qIdx) => {
                                                const r = respuestasPorPregunta.get(q.id);
                                                const texto = q.soloArchivo
                                                    ? (r?.contenidoArchivo || r?.contenido)
                                                    : (r?.respuestaIa || r?.contenidoArchivo || r?.respuestaUsuario || r?.contenido);
                                                return (
                                                    <div key={q.id} style={{
                                                        paddingBottom: qIdx < preguntas.length - 1 ? 'var(--space-4)' : 0,
                                                    }}>
                                                        {preguntas.length > 1 && (
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                {t('execution:results.pregunta_label', { num: qIdx + 1 })}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 'var(--space-3)' }}>
                                                            {q.enunciado}
                                                        </div>
                                                        {r?.archivoNombre && (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-success-bg)', color: 'var(--color-success-strong)', border: '1px solid var(--color-success-border)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                                                                📎 {r.archivoNombre}
                                                            </div>
                                                        )}
                                                        {texto ? (
                                                            <div style={markdownBoxStyle}>
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    components={{
                                                                        table: ({ node, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0.75rem 0', fontSize: '0.875rem' }} {...props} />,
                                                                        th: ({ node, ...props }) => <th style={{ border: '1px solid var(--color-border-strong)', padding: '8px 12px', background: 'var(--color-bg-subtle)', textAlign: 'left', fontWeight: 600 }} {...props} />,
                                                                        td: ({ node, ...props }) => <td style={{ border: '1px solid var(--color-border-strong)', padding: '8px 12px' }} {...props} />,
                                                                        p: ({ node, ...props }) => <p style={{ margin: '0 0 0.75rem', lineHeight: 1.7, textAlign: 'justify' }} {...props} />,
                                                                    }}
                                                                >
                                                                    {texto}
                                                                </ReactMarkdown>
                                                            </div>
                                                        ) : (
                                                            <div style={{ padding: 'var(--space-4)', textAlign: 'center', background: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                                                {t('execution:results.no_response')}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        // Legacy: pasos sin preguntas
                                        (() => {
                                            const interaccion = data.interacciones.find(i => i.pasoId === paso.id);
                                            return interaccion ? (
                                                <div style={markdownBoxStyle}>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {interaccion.contenidoArchivo || interaccion.contenido}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div style={{ padding: 'var(--space-5)', textAlign: 'center', background: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                                    {t('execution:results.no_response')}
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                    {t('execution:results.close_hint')}
                </p>
            </div>
        </div>
        </>
    );
}
