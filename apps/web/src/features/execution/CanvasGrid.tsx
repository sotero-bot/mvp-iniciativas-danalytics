import React from 'react';

interface PasoItem {
    id: string;
    titulo: string;
    orden: number;
}

interface CanvasGridProps {
    bloques: Record<string, string>;
    pasos: PasoItem[];
}

// Colores por orden del bloque (B1–B10 = orden 1–10)
function colorByOrden(orden: number): { background: string; border: string; label: string } {
    if (orden === 1 || orden === 2) {
        // B1 Problema, B2 Datos — azul
        return { background: '#EFF6FF', border: '#BFDBFE', label: '#1D4ED8' };
    }
    if (orden === 3 || orden === 4) {
        // B3 KPIs, B4 Modelo analítico — violeta
        return { background: '#F5F3FF', border: '#DDD6FE', label: '#6D28D9' };
    }
    if (orden === 5 || orden === 6) {
        // B5 Usuarios, B6 Equipo — cyan
        return { background: '#ECFEFF', border: '#A5F3FC', label: '#0E7490' };
    }
    if (orden === 7) {
        // B7 Entregables — verde
        return { background: '#F0FDF4', border: '#A7F3D0', label: '#047857' };
    }
    if (orden === 8) {
        // B8 Riesgos — ámbar
        return { background: '#FFFBEB', border: '#FDE68A', label: '#B45309' };
    }
    if (orden === 9) {
        // B9 Potencial valor estratégico — naranja
        return { background: '#FFF7ED', border: '#FDBA74', label: '#C2410C' };
    }
    if (orden === 10) {
        // B10 Valor — rojo
        return { background: '#FFF1F2', border: '#FECDD3', label: '#BE123C' };
    }
    // Fallback
    return { background: '#F8FAFC', border: '#E2E8F0', label: '#475569' };
}

const SkeletonBlock: React.FC = () => (
    <div style={{
        background: '#F1F5F9',
        borderRadius: 8,
        height: 80,
        animation: 'pulse 1.5s ease-in-out infinite',
    }}>
        <style>{`
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `}</style>
    </div>
);

export function CanvasGrid({ bloques, pasos }: CanvasGridProps) {
    const pasosOrdenados = [...pasos].sort((a, b) => a.orden - b.orden);

    return (
        <div>
            <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#0F172A',
                marginBottom: '1rem',
                letterSpacing: '-0.02em',
            }}>
                Analytics Canvas
            </h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.875rem',
            }}>
                {pasosOrdenados.map((paso) => {
                    const colores = colorByOrden(paso.orden);
                    const resumen = bloques[paso.id];
                    return (
                        <div
                            key={paso.id}
                            style={{
                                background: colores.background,
                                border: `1px solid ${colores.border}`,
                                borderRadius: 10,
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                minHeight: 140,
                            }}
                        >
                            <div style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: colores.label,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                            }}>
                                B{paso.orden} — {paso.titulo}
                            </div>
                            {resumen ? (
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.85rem',
                                    color: '#1E293B',
                                    lineHeight: 1.6,
                                }}>
                                    {resumen}
                                </p>
                            ) : (
                                <SkeletonBlock />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
