import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildResumenHtml } from './buildResumenHtml';

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
    pasos: Paso[];
    interacciones: Interaccion[];
    respuestas?: RespuestaPregunta[];
    fechaInicio?: string;
    fechaFin?: string;
}

export function RunnerResultsPage() {
    const { token } = useParams<{ token: string }>();
    const [data, setData] = useState<RunnerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`${API_URL}/execution/${token}`);
                if (!res.ok) throw new Error('No se pudo cargar los resultados');
                setData(await res.json());
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    if (loading) return (
        <div className="runner-center">
            <div style={{ width: 20, height: 20, border: '2px solid #DBEAFE', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Cargando resultados...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
    if (error) return <div className="runner-center" style={{ color: '#EF4444' }}>⚠ {error}</div>;
    if (!data) return null;

    const respuestasPorPregunta = new Map((data.respuestas ?? []).map(r => [r.preguntaId, r]));

    const pasoRespondido = (p: Paso) =>
        p.preguntas && p.preguntas.length > 0
            ? p.preguntas.every(q => respuestasPorPregunta.has(q.id))
            : data.interacciones.some(i => i.pasoId === p.id);

    const completedCount = data.pasos.filter(pasoRespondido).length;

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

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(160deg, #F0F4FF 0%, #F8FAFC 50%, #FDF8FF 100%)',
            padding: '0 1rem 4rem',
        }}>

            {/* Top bar */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(226,232,240,0.8)',
                padding: '0 1.5rem', height: 52,
                display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
            }}>
                <img
                    src="/logo-horizontal.png"
                    alt="Danalytics"
                    style={{ height: 36, objectFit: 'contain', justifySelf: 'start' }}
                />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', letterSpacing: '-0.02em' }}>
                    Decisión IA
                </span>
                <div style={{ justifySelf: 'end' }}>
                    <button
                        onClick={handleDescargar}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 14px', borderRadius: 8,
                            background: '#2563EB', color: 'white',
                            border: 'none', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 600,
                        }}
                    >
                        ⬇ Descargar HTML
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: 1560, margin: '0 auto', paddingTop: '2.5rem' }}>

                {/* Header */}
                <div style={{
                    background: 'white', borderRadius: 12, border: '1px solid var(--color-border)',
                    padding: '2rem', marginBottom: '1.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: '#ECFDF5', color: '#059669',
                                border: '1px solid #A7F3D0',
                                padding: '3px 12px', borderRadius: 9999,
                                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                                marginBottom: 12,
                            }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                                Completada
                            </div>
                            <h1 style={{ fontSize: '1.5rem', marginBottom: 6 }}>{data.nombreActividad}</h1>
                            {data.descripcionActividad && (
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)', maxWidth: 480, textAlign: 'justify' }}>
                                    {data.descripcionActividad}
                                </p>
                            )}
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{completedCount}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>pasos completados</div>
                            </div>
                            {data.fechaFin && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                                        {new Date(data.fechaFin).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>fecha finalización</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {data.pasos.map((paso, idx) => {
                        const preguntas = paso.preguntas ?? [];
                        const respondido = pasoRespondido(paso);
                        return (
                            <div key={paso.id} style={{
                                background: 'white', borderRadius: 10,
                                border: '1px solid var(--color-border)',
                                overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}>
                                {/* Step header */}
                                <div style={{
                                    padding: '1rem 1.25rem',
                                    background: 'var(--color-bg-subtle)',
                                    borderBottom: '1px solid var(--color-border)',
                                    display: 'flex', gap: '0.875rem', alignItems: 'flex-start',
                                }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                        background: respondido ? 'var(--color-primary)' : 'var(--color-border)',
                                        color: 'white',
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
                                <div style={{ padding: '1.25rem' }}>
                                    {preguntas.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {preguntas.map((q, qIdx) => {
                                                const r = respuestasPorPregunta.get(q.id);
                                                // Para preguntas solo-archivo, el contenido del archivo subido es la respuesta;
                                                // ignorar respuestaIa (puede traer ruido tipo "no recibí mensaje").
                                                const texto = q.soloArchivo
                                                    ? (r?.contenidoArchivo || r?.contenido)
                                                    : (r?.respuestaIa || r?.contenidoArchivo || r?.respuestaUsuario || r?.contenido);
                                                return (
                                                    <div key={q.id} style={{
                                                        paddingBottom: qIdx < preguntas.length - 1 ? 16 : 0,
                                                        borderBottom: qIdx < preguntas.length - 1 ? '1px solid #F1F5F9' : 'none',
                                                    }}>
                                                        {preguntas.length > 1 && (
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                Pregunta {qIdx + 1}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 10 }}>
                                                            {q.enunciado}
                                                        </div>
                                                        {r?.archivoNombre && (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F0FDF4', color: '#166534', border: '1px solid #86EFAC', padding: '3px 10px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 500, marginBottom: 8 }}>
                                                                📎 {r.archivoNombre}
                                                            </div>
                                                        )}
                                                        {texto ? (
                                                            <div style={{ padding: '1rem 1.25rem', background: '#FAFBFF', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.9rem', color: '#1E293B', lineHeight: 1.7, overflowX: 'auto' }}>
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    components={{
                                                                        table: ({ node, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0.75rem 0', fontSize: '0.875rem' }} {...props} />,
                                                                        th: ({ node, ...props }) => <th style={{ border: '1px solid #CBD5E1', padding: '8px 12px', background: '#F1F5F9', textAlign: 'left', fontWeight: 600 }} {...props} />,
                                                                        td: ({ node, ...props }) => <td style={{ border: '1px solid #CBD5E1', padding: '8px 12px' }} {...props} />,
                                                                        p: ({ node, ...props }) => <p style={{ margin: '0 0 0.75rem', lineHeight: 1.7, textAlign: 'justify' }} {...props} />,
                                                                    }}
                                                                >
                                                                    {texto}
                                                                </ReactMarkdown>
                                                            </div>
                                                        ) : (
                                                            <div style={{ padding: '1rem', textAlign: 'center', background: '#FAFAFA', border: '1px dashed var(--color-border)', borderRadius: 8, color: 'var(--color-text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                                                Sin respuesta registrada
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
                                                <div style={{ padding: '1rem 1.25rem', background: '#FAFBFF', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.9rem', color: '#1E293B', lineHeight: 1.7, overflowX: 'auto' }}>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {interaccion.contenidoArchivo || interaccion.contenido}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div style={{ padding: '1.5rem', textAlign: 'center', background: '#FAFAFA', border: '1px dashed var(--color-border)', borderRadius: 8, color: 'var(--color-text-tertiary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                                    Sin respuesta registrada
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                    Puedes cerrar esta ventana.
                </p>
            </div>
        </div>
    );
}
