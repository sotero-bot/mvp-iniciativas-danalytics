import type { ReactNode } from 'react';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Color de acento del borde superior (token var(--...)). */
  accent?: string;
  className?: string;
}

/**
 * Tarjeta de KPI. Reemplaza el patrón inline
 * `{ padding:'1rem' } + label 0.78rem + valor 1.35rem 700`.
 * Usa `.stat-card` de index.css. Combina con `.stat-grid`.
 */
export function StatCard({ label, value, hint, accent, className }: StatCardProps) {
  return (
    <div
      className={`stat-card${className ? ` ${className}` : ''}`}
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
      {hint && <span className="stat-card-hint">{hint}</span>}
    </div>
  );
}
