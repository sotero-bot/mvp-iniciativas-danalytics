import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Icono opcional (ej. `<SidebarIcon />`) mostrado en un cuadro con tinte. */
  icon?: ReactNode;
  /**
   * Color de acento categórico (hex literal de `ROLE_CARDS`, no token): tiñe
   * el cuadro del icono. Es la excepción sancionada de acentos por sección
   * (ver DESIGN.md → Colors → Acentos categóricos de sección).
   */
  accent?: string;
  /** Si existe, el tile completo es un enlace navegable (con flecha de afordancia). */
  to?: string;
  className?: string;
}

/**
 * Tarjeta de KPI. Plana, recta, hairline — la jerarquía la da el número
 * (grande, tabular). Con `to` el tile entero navega; con `icon`+`accent`
 * lleva el icono de sección teñido. Usa `.stat-card` de index.css.
 */
export function StatCard({ label, value, hint, icon, accent, to, className }: StatCardProps) {
  const iconTint = accent
    ? { background: `${accent}1f`, border: `1px solid ${accent}55`, color: accent }
    : undefined;

  const inner = (
    <>
      <div className="stat-card-head">
        {icon && (
          <span className="stat-card-icon" style={iconTint} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="stat-card-label">{label}</span>
      </div>
      <span className="stat-card-value">{value}</span>
      {hint && <span className="stat-card-hint">{hint}</span>}
      {to && (
        <span className="stat-card-arrow" aria-hidden="true">
          ›
        </span>
      )}
    </>
  );

  const cls = `stat-card${className ? ` ${className}` : ''}`;
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
