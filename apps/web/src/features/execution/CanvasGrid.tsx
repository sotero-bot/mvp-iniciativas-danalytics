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
}

// Todos los slots comparten el mismo tratamiento plano (tokens de marca): el
// canvas se lee por posición/etiqueta, no por un color distinto por bloque.
const SLOT_STYLES: Record<SlotKey, SlotStyle> = {
    datos:         { area: 'datos' },
    oportunidad:   { area: 'oportunidad' },
    problema:      { area: 'problema' },
    usuarios:      { area: 'usuarios' },
    actores:       { area: 'actores' },
    indicadores:   { area: 'indicadores' },
    entregables:   { area: 'entregables' },
    restricciones: { area: 'restricciones' },
    recursos:      { area: 'recursos' },
    valor:         { area: 'valor' },
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

function StickyNote({ text }: { text: string }) {
    return (
        <div style={{
            background: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 'var(--radius-chip)',
            padding: '0.45rem 0.6rem',
            fontSize: '0.78rem',
            color: 'var(--color-text-main)',
            lineHeight: 1.45,
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
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minHeight: 90,
        }}>
            <div style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
            }}>
                {label}
            </div>

            {isEmpty ? (
                <div style={{
                    flex: 1,
                    border: '1px dashed var(--color-border-strong)',
                    borderRadius: 0,
                    minHeight: 48,
                    opacity: 0.5,
                }} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {lines.map((line, i) => (
                        <StickyNote key={i} text={line} />
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
                color: 'var(--color-text-main)',
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
