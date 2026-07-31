import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  /** Título de la página. Debe venir ya traducido (t('...')). */
  title: ReactNode;
  /**
   * Etiqueta de contexto sobre el título (paso, sección o entidad
   * seleccionada). Úsala para que el usuario sepa "dónde está" — p. ej. el
   * nombre del programa cuya vista se está mostrando.
   */
  eyebrow?: ReactNode;
  /** Texto descriptivo opcional bajo el título. */
  description?: ReactNode;
  /** Enlace "volver" opcional (ruta + etiqueta ya traducida). */
  back?: { to: string; label: string };
  /** Acciones a la derecha (botón primario de la vista). */
  actions?: ReactNode;
}

/**
 * Encabezado de página unificado (estilo sobrio). Título en Poppins, eyebrow de
 * contexto y acciones alineadas a la derecha. Usa `.page-header` de index.css.
 * Suele ir precedido de `<Breadcrumb>`.
 */
export function PageHeader({ title, eyebrow, description, back, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        {back && (
          <Link to={back.to} className="btn-link" style={{ marginBottom: '0.5rem' }}>
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="page-header-subtitle">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
