interface LoadingProps {
  /** Texto ya traducido (p. ej. t('common:actions.loading')). */
  label?: string;
  /** Variante en línea (sin padding vertical). */
  inline?: boolean;
  className?: string;
}

/**
 * Indicador de carga unificado. Reemplaza los "Cargando…" ad-hoc repartidos
 * por casi todas las pantallas. Usa `.loading` + `.spinner` de index.css.
 */
export function Loading({ label, inline, className }: LoadingProps) {
  return (
    <div
      className={`loading${inline ? ' loading-inline' : ''}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="spinner" aria-hidden="true" />
      {label && <span>{label}</span>}
    </div>
  );
}
