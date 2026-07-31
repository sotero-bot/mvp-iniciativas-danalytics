import type { ReactNode } from 'react';

interface PaginationProps {
  /** Página actual (1-indexada). */
  page: number;
  /** Número total de páginas. */
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Texto ya traducido a la izquierda (p. ej. "Mostrando 1–10 de 63"). */
  info?: ReactNode;
  /** Etiquetas ya traducidas de los controles. */
  prevLabel: string;
  nextLabel: string;
}

/**
 * Paginación (estilo sobrio): info a la izquierda y controles a la derecha,
 * con la página activa en navy. Usa `.pagination` de index.css.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  info,
  prevLabel,
  nextLabel,
}: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <div className="pagination">
      {info && <div>{info}</div>}
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {prevLabel}
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`pagination-btn${p === page ? ' pagination-btn-active' : ''}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="pagination-btn"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
