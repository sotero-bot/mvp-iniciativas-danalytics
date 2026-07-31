import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'link';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primary` = azul empresa (navy). Es la acción principal de confirmar /
   * enviar / crear y debe ir a la derecha (usa `.form-footer` / `.actions-end`
   * o `<PageHeader actions>`).
   */
  variant?: ButtonVariant;
  /** Botón compacto (acciones inline en filas de tabla). */
  size?: 'sm';
  /** Ocupa todo el ancho (submit al pie de un formulario en columna). */
  block?: boolean;
  children: ReactNode;
}

/**
 * Botón unificado. Envuelve las clases `.btn` / `.btn-*` de index.css para no
 * repetir `className` a mano. Para navegación usa `<Link className="btn ...">`.
 */
export function Button({
  variant = 'primary',
  size,
  block,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
