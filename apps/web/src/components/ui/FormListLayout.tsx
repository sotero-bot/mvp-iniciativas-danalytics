import type { ReactNode } from 'react';

interface FormListLayoutProps {
  /** Formulario de registro (columna izquierda, más estrecha). */
  form: ReactNode;
  /** Listado de lo ya registrado (columna derecha, más ancha). */
  list: ReactNode;
  className?: string;
}

/**
 * Layout de vistas de registro: formulario a la izquierda y listado de lo ya
 * registrado a la derecha (patrón de `/admin/iniciativas`). En móvil se apila
 * (formulario arriba, listado debajo). Usa `.form-list-grid` de index.css.
 */
export function FormListLayout({ form, list, className }: FormListLayoutProps) {
  return (
    <div className={`form-list-grid${className ? ` ${className}` : ''}`}>
      <div style={{ minWidth: 0 }}>{form}</div>
      <div style={{ minWidth: 0 }}>{list}</div>
    </div>
  );
}
