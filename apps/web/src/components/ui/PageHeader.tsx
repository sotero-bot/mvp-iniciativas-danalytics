import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  /** Título de la página. Debe venir ya traducido (t('...')). */
  title: ReactNode;
  /** Texto descriptivo opcional bajo el título. */
  description?: ReactNode;
  /** Enlace "volver" opcional (ruta + etiqueta ya traducida). */
  back?: { to: string; label: string };
  /** Acciones a la derecha (botones). */
  actions?: ReactNode;
}

/**
 * Encabezado de página unificado. Reemplaza el patrón repetido de
 * `<Link>` + `<h1 style={{ fontSize:'1.4rem', margin:'0.75rem 0 1.25rem' }}>`.
 * Usa la clase `.page-header` de index.css.
 */
export function PageHeader({ title, description, back, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        {back && (
          <Link
            to={back.to}
            className="btn-link"
            style={{ marginBottom: '0.5rem' }}
          >
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </div>
  );
}
