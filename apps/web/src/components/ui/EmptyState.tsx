import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Icono/emoji o nodo. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Acción opcional (botón). */
  action?: ReactNode;
}

/**
 * Estado vacío unificado. Usa `.empty-state` de index.css.
 */
export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
}
