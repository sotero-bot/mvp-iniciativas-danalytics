interface ProgressBarProps {
  /** Valor 0-100. */
  value: number;
  /** Color del relleno (por defecto el primario). Debe ser un token var(--...). */
  color?: string;
  /** Etiqueta accesible del progreso. */
  label?: string;
  className?: string;
}

/**
 * Barra de progreso. Reemplaza el bloque inline duplicado
 * (track `#E2E8F0` + fill `#14B8A6/#38BDF8`). Usa `.progress` de index.css.
 */
export function ProgressBar({ value, color, label, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`progress${className ? ` ${className}` : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="progress-fill"
        style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  );
}
