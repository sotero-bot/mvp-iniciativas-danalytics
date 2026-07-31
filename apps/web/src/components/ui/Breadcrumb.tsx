import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  /** Etiqueta ya traducida (o nombre de entidad, p. ej. el programa). */
  label: ReactNode;
  /** Ruta destino. El último ítem (la vista actual) se deja sin `to`. */
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Miga de pan. Indica SIEMPRE dónde está el usuario. Cuando la vista depende
 * de una entidad seleccionada (un programa, una empresa…), incluye esa
 * entidad como un ítem para que quede claro qué se está viendo.
 *
 * El último ítem se renderiza como actual (no enlazado) aunque traiga `to`.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={`breadcrumb${className ? ` ${className}` : ''}`} aria-label="breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
            {isLast || !item.to ? (
              <span className="breadcrumb-current" aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
