import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  /** Clave única de la columna. */
  key: string;
  /** Encabezado ya traducido. */
  header: ReactNode;
  /** Contenido de la celda para una fila. */
  render: (row: T) => ReactNode;
  /** Alineación del texto de la columna. `right` para la columna de acciones. */
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Clave estable por fila (para React). */
  rowKey: (row: T) => string;
  /** Mensaje ya traducido cuando no hay filas. */
  emptyMessage?: ReactNode;
}

/**
 * Tabla hairline (estilo sobrio). Renderiza un `<table>` semántico con los
 * estilos base de index.css. Marca la columna de acciones con `align: 'right'`.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ color: 'var(--color-text-tertiary)' }}>
                {emptyMessage ?? '—'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
