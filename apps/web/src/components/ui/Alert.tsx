import type { ReactNode } from 'react';

type AlertVariant = 'success' | 'danger' | 'warning' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** Icono/emoji opcional; por defecto uno según la variante. */
  icon?: ReactNode;
  className?: string;
}

const DEFAULT_ICON: Record<AlertVariant, string> = {
  success: '✓',
  danger: '⚠',
  warning: '⚠',
  info: 'ℹ',
};

/**
 * Mensaje inline de estado (éxito/error/aviso/info). Reemplaza las cajas
 * rgba/hex repetidas de auth y las cajas de error ad-hoc. Usa `.alert` de
 * index.css. `role` se ajusta a la severidad para lectores de pantalla.
 */
export function Alert({ variant = 'info', title, children, icon, className }: AlertProps) {
  const resolvedIcon = icon ?? DEFAULT_ICON[variant];
  return (
    <div
      className={`alert alert-${variant}${className ? ` ${className}` : ''}`}
      role={variant === 'danger' ? 'alert' : 'status'}
    >
      {resolvedIcon && <span className="alert-icon" aria-hidden="true">{resolvedIcon}</span>}
      <div className="alert-body">
        {title && <p className="alert-title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
