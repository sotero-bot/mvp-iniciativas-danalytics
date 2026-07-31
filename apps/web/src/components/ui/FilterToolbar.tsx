import type { ReactNode } from 'react';

interface FilterToolbarProps {
  /** Búsqueda, selects y separadores (`<FilterToolbar.Divider />`). */
  children: ReactNode;
  className?: string;
}

/**
 * Fila de filtros (búsqueda + selects) para las cabeceras de un listado.
 * Usa `.filter-bar` de index.css; separa grupos con `<FilterToolbar.Divider />`.
 */
export function FilterToolbar({ children, className }: FilterToolbarProps) {
  return <div className={`filter-bar${className ? ` ${className}` : ''}`}>{children}</div>;
}

FilterToolbar.Divider = function FilterDivider() {
  return <div className="filter-bar-divider" aria-hidden="true" />;
};
