import type { ReactNode } from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: ReactNode;
  className?: string;
  title?: string;
}

/**
 * Badge de estado unificado. Reemplaza los mapas inline `{ bg, fg, border }`
 * con hex crudos. Usa `.status-badge` + `.status-*` de index.css.
 */
export function StatusBadge({ variant = 'neutral', children, className, title }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${variant}${className ? ` ${className}` : ''}`} title={title}>
      {children}
    </span>
  );
}
