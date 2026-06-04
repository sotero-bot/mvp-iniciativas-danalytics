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

// Mapeo keyword → slot del canvas
type SlotKey =
    | 'datos' | 'oportunidad' | 'problema' | 'usuarios' | 'actores'
    | 'indicadores' | 'entregables' | 'restricciones' | 'valor' | 'recursos';

interface SlotConfig {
    label: string;
    area: string;
    bg: string;
    border: string;
    labelColor: string;
    stickyBg: string;
}

const SLOTS: Record<SlotKey, SlotConfig> = {
    datos:        { label: 'Datos y fuentes',          area: 'datos',        bg: '#F5F3FF', border: '#DDD6FE', labelColor: '#5B21B6', stickyBg: '#EDE9FE' },
    oportunidad:  { label: 'Oportunidad',              area: 'oportunidad',  bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
    problema:     { label: 'Problema o reto actual',   area: 'problema',     bg: '#FFF7ED', border: '#FDBA74', labelColor: '#C2410C', stickyBg: '#FED7AA' },
    usuarios:     { label: 'Usuarios',                 area: 'usuarios',     bg: '#FDF2F8', border: '#F9A8D4', labelColor: '#9D174D', stickyBg: '#FCE7F3' },
    actores:      { label: 'Actores principales',      area: 'actores',      bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
    indicadores:  { label: 'Indicadores de éxito',     area: 'indicadores',  bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
    entregables:  { label: 'Entregables',              area: 'entregables',  bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
    restricciones:{ label: 'Restricciones',            area: 'restricciones',bg: '#FFF1F2', border: '#FECDD3', labelColor: '#BE123C', stickyBg: '#FFE4E6' },
    recursos:     { label: 'Recursos requeridos',      area: 'recursos',     bg: '#F8FAFC', border: '#E2E8F0', labelColor: '#475569', stickyBg: '#F1F5F9' },
    valor:        { label: 'Potencial de valor',       area: 'valor',        bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
};

function matchSlot(titulo: string): SlotKey | null {
    const t = titulo.toLowerCase();
    if (t.includes('dato') || t.includes('fuente')) return 'datos';
    if (t.includes('solución') || t.includes('solucion') || t.includes('oportunidad')) return 'oportunidad';
    if (t.includes('problema') || t.includes('reto')) return 'problema';
    if (t.includes('usuario')) return 'usuarios';
    if (t.includes('actor') || t.includes('equipo') || t.includes('responsable')) return 'actores';
    if (t.includes('kpi') || t.includes('indicador') || t.includes('éxito') || t.includes('exito')) return 'indicadores';
    if (t.includes('entregable')) return 'entregables';
    if (t.includes('barrera') || t.includes('riesgo') || t.includes('restricción') || t.includes('restriccion')) return 'restricciones';
    if (t.includes('valor') || t.includes('potencial') || t.includes('estratégico') || t.includes('estrategico')) return 'valor';
    return null;
}

function StickyNote({ text, bg }: { text: string; bg: string }) {
    return (
        <div style={{
            background: bg,
            borderRadius: 6,
            padding: '0.45rem 0.6rem',
            fontSize: '0.78rem',
            color: '#1E293B',
            lineHeight: 1.45,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
            {text}
        </div>
    );
}

function CanvasBlock({
    slot,
    lines,
    isEmpty,
}: {
    slot: SlotConfig;
    lines: string[];
    isEmpty: boolean;
}) {
    return (
        <div style={{
            gridArea: slot.area,
            background: slot.bg,
            border: `1px solid ${slot.border}`,
            borderRadius: 10,
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minHeight: 90,
        }}>
            <div style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: slot.labelColor,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
            }}>
                {slot.label}
            </div>

            {isEmpty ? (
                <div style={{
                    flex: 1,
                    border: `1px dashed ${slot.border}`,
                    borderRadius: 6,
                    minHeight: 48,
                    opacity: 0.5,
                }} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {lines.map((line, i) => (
                        <StickyNote key={i} text={line} bg={slot.stickyBg} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function CanvasGrid({ bloques, pasos }: CanvasGridProps) {
    // Mapear pasos a slots
    const slotMap: Partial<Record<SlotKey, { lines: string[] }>> = {};
    for (const paso of pasos) {
        const key = matchSlot(paso.titulo);
        if (!key) continue;
        const raw = bloques[paso.id] ?? '';
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        slotMap[key] = { lines };
    }

    const renderSlot = (key: SlotKey) => {
        const cfg = SLOTS[key];
        const data = slotMap[key];
        const lines = data?.lines ?? [];
        return (
            <CanvasBlock
                key={key}
                slot={cfg}
                lines={lines}
                isEmpty={lines.length === 0}
            />
        );
    };

    return (
        <div>
            <h2 style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0F172A',
                marginBottom: '0.875rem',
                letterSpacing: '-0.02em',
            }}>
                Lienzo de oportunidad
            </h2>

            {/* Grid layout replicando imagen de referencia */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1.4fr 1fr 1fr',
                gridTemplateRows: 'auto auto auto',
                gridTemplateAreas: `
                    "datos oportunidad  problema usuarios  actores"
                    "datos indicadores  problema entregables actores"
                    "restricciones restricciones recursos valor valor"
                `,
                gap: '0.6rem',
            }}>
                {renderSlot('datos')}
                {renderSlot('oportunidad')}
                {renderSlot('problema')}
                {renderSlot('usuarios')}
                {renderSlot('actores')}
                {renderSlot('indicadores')}
                {renderSlot('entregables')}
                {renderSlot('restricciones')}
                {/* Recursos requeridos: siempre vacío, sin pasoId */}
                <CanvasBlock slot={SLOTS.recursos} lines={[]} isEmpty={true} />
                {renderSlot('valor')}
            </div>
        </div>
    );
}
