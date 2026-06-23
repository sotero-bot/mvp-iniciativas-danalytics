import React from 'react';
import { useTranslation } from 'react-i18next';

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

interface SlotStyle {
    area: string;
    bg: string;
    border: string;
    labelColor: string;
    stickyBg: string;
}

const SLOT_STYLES: Record<SlotKey, SlotStyle> = {
    datos:        { area: 'datos',         bg: '#F5F3FF', border: '#DDD6FE', labelColor: '#5B21B6', stickyBg: '#EDE9FE' },
    oportunidad:  { area: 'oportunidad',   bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
    problema:     { area: 'problema',      bg: '#FFF7ED', border: '#FDBA74', labelColor: '#C2410C', stickyBg: '#FED7AA' },
    usuarios:     { area: 'usuarios',      bg: '#FDF2F8', border: '#F9A8D4', labelColor: '#9D174D', stickyBg: '#FCE7F3' },
    actores:      { area: 'actores',       bg: '#EFF6FF', border: '#BFDBFE', labelColor: '#1D4ED8', stickyBg: '#DBEAFE' },
    indicadores:  { area: 'indicadores',   bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
    entregables:  { area: 'entregables',   bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
    restricciones:{ area: 'restricciones', bg: '#FFF1F2', border: '#FECDD3', labelColor: '#BE123C', stickyBg: '#FFE4E6' },
    recursos:     { area: 'recursos',      bg: '#F8FAFC', border: '#E2E8F0', labelColor: '#475569', stickyBg: '#F1F5F9' },
    valor:        { area: 'valor',         bg: '#F0FDF4', border: '#A7F3D0', labelColor: '#065F46', stickyBg: '#D1FAE5' },
};

const ORDEN_TO_SLOT: Record<number, SlotKey> = {
    1: 'problema',
    2: 'oportunidad',
    3: 'datos',
    4: 'usuarios',
    5: 'entregables',
    6: 'actores',
    7: 'indicadores',
    8: 'restricciones',
    9: 'valor',
};

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
    label,
    lines,
    isEmpty,
}: {
    slot: SlotStyle;
    label: string;
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
                {label}
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
    const { t } = useTranslation(['execution']);

    const labels: Record<SlotKey, string> = {
        datos: t('execution:canvas.blocks.datos'),
        oportunidad: t('execution:canvas.blocks.oportunidad'),
        problema: t('execution:canvas.blocks.problema'),
        usuarios: t('execution:canvas.blocks.usuarios'),
        actores: t('execution:canvas.blocks.actores'),
        indicadores: t('execution:canvas.blocks.indicadores'),
        entregables: t('execution:canvas.blocks.entregables'),
        restricciones: t('execution:canvas.blocks.restricciones'),
        recursos: t('execution:canvas.blocks.recursos'),
        valor: t('execution:canvas.blocks.potencial'),
    };

    // Mapear pasos a slots por orden (independiente del idioma)
    const slotMap: Partial<Record<SlotKey, { lines: string[] }>> = {};
    for (const paso of pasos) {
        const key = ORDEN_TO_SLOT[paso.orden];
        if (!key) continue;
        const raw = bloques[paso.id] ?? '';
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        slotMap[key] = { lines };
    }

    const renderSlot = (key: SlotKey) => {
        const cfg = SLOT_STYLES[key];
        const data = slotMap[key];
        const lines = data?.lines ?? [];
        return (
            <CanvasBlock
                key={key}
                slot={cfg}
                label={labels[key]}
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
                {t('execution:results.canvas_title')}
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
                <CanvasBlock slot={SLOT_STYLES.recursos} label={labels.recursos} lines={[]} isEmpty={true} />
                {renderSlot('valor')}
            </div>
        </div>
    );
}
