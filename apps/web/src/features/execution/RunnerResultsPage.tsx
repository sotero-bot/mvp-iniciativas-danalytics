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

interface Interaccion {
    pasoId: string;
    contenido: string;
    fecha: string;
}

interface RunnerData {
    estado: string;
    nombreActividad: string;
    descripcionActividad?: string;
    pasos: Paso[];
    interacciones: Interaccion[];
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

    if (loading) return <div className="runner-center">Cargando resultados...</div>;
    if (error) return <div className="runner-center" style={{ color: '#ef4444' }}>Error: {error}</div>;
    if (!data) return null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg-page)', padding: '2rem 1rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 900 }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <span className="status-badge status-success" style={{ display: 'inline-block', marginBottom: 10 }}>✅ Actividad Completada</span>
                    <h1 style={{ marginBottom: '0.5rem' }}>{data.nombreActividad}</h1>
                    {data.descripcionActividad && (
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 0 }}>{data.descripcionActividad}</p>
                    )}
                    {data.fechaFin && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
                            Completado: {new Date(data.fechaFin).toLocaleString()}
                        </p>
                    )}
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {data.pasos.map((paso, idx) => {
                        const interaccion = data.interacciones.find(i => i.pasoId === paso.id);
                        return (
                            <div key={paso.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Step Header */}
                                <div style={{
                                    padding: '1.25rem 1.5rem',
                                    borderBottom: '1px solid var(--color-bg-page)',
                                    background: 'var(--color-bg-subtle)',
                                    display: 'flex',
                                    gap: '1rem',
                                    alignItems: 'flex-start'
                                }}>
                                    <div style={{
                                        background: 'var(--color-primary)', color: 'white',
                                        width: 32, height: 32, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 'bold', flexShrink: 0, fontSize: '0.9rem'
                                    }}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{paso.titulo}</h4>
                                        {paso.objetivo && (
                                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>
                                                Objetivo: {paso.objetivo}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Step Response */}
                                <div style={{ padding: '1.5rem' }}>
                                    {interaccion ? (
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                                                Respuesta
                                            </div>
                                            <div style={{
                                                padding: '1.25rem',
                                                background: 'white',
                                                border: '1px solid var(--color-bg-page)',
                                                borderRadius: 8,
                                                lineHeight: 1.6,
                                                fontSize: '1rem',
                                                color: '#1e293b',
                                                overflowX: 'auto'
                                            }}>
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        table: ({ node, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0.75rem 0' }} {...props} />,
                                                        th: ({ node, ...props }) => <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', background: '#f1f5f9', textAlign: 'left' }} {...props} />,
                                                        td: ({ node, ...props }) => <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px' }} {...props} />,
                                                        p: ({ node, ...props }) => <p style={{ marginBottom: '0.75rem' }} {...props} />,
                                                    }}
                                                >
                                                    {interaccion.contenido}
                                                </ReactMarkdown>
                                            </div>
                                            <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#94a3b8', textAlign: 'right' }}>
                                                Respondido: {new Date(interaccion.fecha).toLocaleString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '1.5rem', textAlign: 'center', background: '#fcfcfc', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#94a3b8', fontStyle: 'italic' }}>
                                            Sin respuesta
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
